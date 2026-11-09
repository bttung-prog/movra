import "dotenv/config";

import connectDB from "./configs/db.connect.js";

import app from "./app.js";

import { initSchedulers, stopSchedulers } from "./jobs/index.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    initSchedulers();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    const gracefulShutdown = () => {
      console.log("Shutting down server gracefully...");
      stopSchedulers();
      server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    console.log(`Error when server start: ${error.message}`);
    process.exit(1);
  }
};

startServer();
