import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_CONNECTION_STR);
    console.log("Database connected successfully");
  } catch (error) {
    console.error(`Error when connecting database: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
