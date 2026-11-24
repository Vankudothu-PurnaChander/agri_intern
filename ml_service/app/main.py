"""FastAPI Application for Agricultural Market Intelligence ML Service.
Connects Python ML pipeline with Node.js Express backend.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ml_service.app.routes import forecast, analysis, training

app = FastAPI(
    title="Warangal Agri Market Intelligence ML API",
    description="Statistical Analysis and Machine Learning Price Forecasting Service for Warangal District",
    version="1.0.0"
)

# Enable CORS for internal Node.js backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(forecast.router)
app.include_router(analysis.router)
app.include_router(training.router)

@app.get("/")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "Warangal Agri Intelligence ML Service",
        "district": "Warangal",
        "state": "Telangana",
        "target_crops": 7
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ml_service.app.main:app", host="0.0.0.0", port=8000, reload=False)

