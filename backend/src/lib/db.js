import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    // Ensure connection uses chat_db by default
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "chat_db"
    });
    console.log(`MongoDB connected: ${conn.connection.host} (DB: chat_db)`);
  } catch (error) {
    console.log("MongoDB connection error:", error);
  }
};