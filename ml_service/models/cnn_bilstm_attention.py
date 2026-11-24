"""CNN-BiLSTM-Attention Deep Learning Architecture in PyTorch.
Extracts local temporal patterns via 1D-CNN, models sequential dependencies
via Bidirectional LSTM, applies temporal attention over historical time steps,
and outputs future price forecasts.
"""
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import MinMaxScaler
from pathlib import Path
from ml_service.config import ML_ARTIFACTS

class TemporalAttention(nn.Module):
    """Calculates self-attention weights across the sequence time steps."""
    def __init__(self, hidden_dim):
        super().__init__()
        self.w = nn.Linear(hidden_dim, hidden_dim)
        self.v = nn.Linear(hidden_dim, 1, bias=False)
        
    def forward(self, rnn_out):
        # rnn_out: (batch_size, seq_len, hidden_dim)
        u = torch.tanh(self.w(rnn_out))  # (batch_size, seq_len, hidden_dim)
        scores = self.v(u)                # (batch_size, seq_len, 1)
        weights = torch.softmax(scores, dim=1) # (batch_size, seq_len, 1)
        context = torch.sum(weights * rnn_out, dim=1) # (batch_size, hidden_dim)
        return context, weights

class CNNBiLSTMAttentionNet(nn.Module):
    def __init__(self, num_features, cnn_out=64, rnn_hidden=64, num_layers=2, dropout=0.2):
        super().__init__()
        # 1. 1D CNN for local feature pattern extraction
        self.conv1d = nn.Conv1d(in_channels=num_features, out_channels=cnn_out, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm1d(cnn_out)
        self.relu = nn.ReLU()
        self.cnn_dropout = nn.Dropout(dropout)
        
        # 2. Bidirectional LSTM
        self.bilstm = nn.LSTM(
            input_size=cnn_out,
            hidden_size=rnn_hidden,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        
        # 3. Temporal Attention Layer
        self.attention = TemporalAttention(hidden_dim=rnn_hidden * 2)
        
        # 4. Dense Forecasting Head
        self.fc = nn.Sequential(
            nn.Linear(rnn_hidden * 2, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )
        
    def forward(self, x):
        # x: (batch_size, seq_len, num_features)
        # Conv1d expects (batch_size, in_channels, seq_len)
        x_cnn = x.transpose(1, 2)
        c = self.cnn_dropout(self.relu(self.bn1(self.conv1d(x_cnn))))
        
        # Back to (batch_size, seq_len, cnn_out)
        c = c.transpose(1, 2)
        
        # BiLSTM
        lstm_out, _ = self.bilstm(c) # (batch_size, seq_len, rnn_hidden * 2)
        
        # Attention
        context, attn_weights = self.attention(lstm_out)
        
        # Forecast output
        out = self.fc(context)
        return out.squeeze(-1), attn_weights

class SequenceDataset(Dataset):
    def __init__(self, sequences, targets):
        self.sequences = torch.tensor(sequences, dtype=torch.float32)
        self.targets = torch.tensor(targets, dtype=torch.float32)
        
    def __len__(self):
        return len(self.sequences)
        
    def __getitem__(self, idx):
        return self.sequences[idx], self.targets[idx]

class DeepLearningForecaster:
    def __init__(self, crop_id, horizon_days=15, window_size=30):
        self.crop_id = crop_id
        self.horizon_days = horizon_days
        self.window_size = window_size
        self.model = None
        self.scaler_x = MinMaxScaler()
        self.scaler_y = MinMaxScaler()
        self.feature_names = None
        self.training_history = []
        self.artifacts_dir = ML_ARTIFACTS / "models"
        self.scalers_dir = ML_ARTIFACTS / "scalers"
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.scalers_dir.mkdir(parents=True, exist_ok=True)
        
    def create_sequences(self, X_scaled, y_scaled):
        sequences = []
        targets = []
        for i in range(len(X_scaled) - self.window_size):
            seq = X_scaled[i : i + self.window_size]
            target = y_scaled[i + self.window_size]
            sequences.append(seq)
            targets.append(target)
        return np.array(sequences), np.array(targets)

    def train(self, X_train, y_train, X_val, y_val, epochs=50, batch_size=32, lr=1e-3):
        self.feature_names = list(X_train.columns)
        num_features = len(self.feature_names)
        
        # Fit scalers strictly on training data
        X_train_s = self.scaler_x.fit_transform(X_train)
        y_train_s = self.scaler_y.fit_transform(y_train.values.reshape(-1, 1)).flatten()
        
        X_val_s = self.scaler_x.transform(X_val)
        y_val_s = self.scaler_y.transform(y_val.values.reshape(-1, 1)).flatten()
        
        seq_train, tar_train = self.create_sequences(X_train_s, y_train_s)
        seq_val, tar_val = self.create_sequences(X_val_s, y_val_s)
        
        if len(seq_train) == 0 or len(seq_val) == 0:
            raise ValueError("Insufficient sequence points for given window size.")
            
        train_ds = SequenceDataset(seq_train, tar_train)
        val_ds = SequenceDataset(seq_val, tar_val)
        
        train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
        
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = CNNBiLSTMAttentionNet(num_features=num_features).to(device)
        
        criterion = nn.SmoothL1Loss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr, weight_decay=1e-5)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=5)
        
        best_val_loss = float("inf")
        best_weights = None
        patience = 12
        patience_counter = 0
        
        for epoch in range(epochs):
            self.model.train()
            train_loss = 0.0
            for bx, by in train_loader:
                bx, by = bx.to(device), by.to(device)
                optimizer.zero_grad()
                out, _ = self.model(bx)
                loss = criterion(out, by)
                loss.backward()
                nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimizer.step()
                train_loss += loss.item() * len(by)
            train_loss /= len(train_ds)
            
            self.model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for bx, by in val_loader:
                    bx, by = bx.to(device), by.to(device)
                    out, _ = self.model(bx)
                    loss = criterion(out, by)
                    val_loss += loss.item() * len(by)
            val_loss /= len(val_ds)
            
            scheduler.step(val_loss)
            self.training_history.append({"epoch": epoch + 1, "train_loss": round(train_loss, 5), "val_loss": round(val_loss, 5)})
            
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_weights = {k: v.cpu().clone() for k, v in self.model.state_dict().items()}
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    break
                    
        if best_weights:
            self.model.load_state_dict(best_weights)
        return self.model

    def predict(self, X_seq):
        """Generates predictions from a batch of sequence windows."""
        self.model.eval()
        device = next(self.model.parameters()).device
        
        if isinstance(X_seq, pd.DataFrame):
            X_s = self.scaler_x.transform(X_seq)
            if len(X_s) < self.window_size:
                raise ValueError(f"Need at least {self.window_size} rows to predict.")
            # Take last window_size rows
            seq = X_s[-self.window_size:].reshape(1, self.window_size, -1)
        else:
            seq = X_seq
            
        with torch.no_grad():
            inp = torch.tensor(seq, dtype=torch.float32).to(device)
            out_scaled, _ = self.model(inp)
            preds_scaled = out_scaled.cpu().numpy().reshape(-1, 1)
            preds = self.scaler_y.inverse_transform(preds_scaled).flatten()
        return preds

    def save(self):
        model_path = self.artifacts_dir / f"dl_cnn_bilstm_attn_{self.crop_id}_{self.horizon_days}d.pt"
        torch.save({
            "state_dict": self.model.state_dict(),
            "features": self.feature_names,
            "window_size": self.window_size,
            "history": self.training_history
        }, model_path)
        
        scalers_path = self.scalers_dir / f"dl_scalers_{self.crop_id}_{self.horizon_days}d.joblib"
        joblib.dump({"scaler_x": self.scaler_x, "scaler_y": self.scaler_y}, scalers_path)
        return model_path

    def load(self):
        model_path = self.artifacts_dir / f"dl_cnn_bilstm_attn_{self.crop_id}_{self.horizon_days}d.pt"
        scalers_path = self.scalers_dir / f"dl_scalers_{self.crop_id}_{self.horizon_days}d.joblib"
        
        scalers = joblib.load(scalers_path)
        self.scaler_x = scalers["scaler_x"]
        self.scaler_y = scalers["scaler_y"]
        
        checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)
        self.feature_names = checkpoint["features"]
        self.window_size = checkpoint["window_size"]
        self.training_history = checkpoint.get("history", [])
        
        self.model = CNNBiLSTMAttentionNet(num_features=len(self.feature_names))
        self.model.load_state_dict(checkpoint["state_dict"])
        self.model.eval()
        return self

