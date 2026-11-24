const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI not provided. Running in file-backed fallback mode.');
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 25,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000
    });
    isConnected = true;
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host} (Pool: 5-25 connections)`);
    return true;
  } catch (error) {
    console.warn(`⚠️ MongoDB connection unavailable (${error.message}). Falling back to local processed dataset engine.`);
    isConnected = false;
    return false;
  }
};

const getDBStatus = () => isConnected;

module.exports = { connectDB, getDBStatus };
