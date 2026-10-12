
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const productRoutes = require("./routes");

const app = express();

app.use(express.json());

// Register all product endpoints
app.use("/api/products", productRoutes);

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err.message);

  if (err.name === "ValidationError" ||
      err.name === "CastError") {
    return res.status(400).json({
      message: err.message
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      message: "SKU already exists"
    });
  }

  res.status(500).json({
    message: "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

startServer();