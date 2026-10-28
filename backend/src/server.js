import "dotenv/config";
import connectDB from "./configs/db.connect.js";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.log(`Error when server start: ${error.message}`);
    process.exit(1);
  }
};

startServer();
