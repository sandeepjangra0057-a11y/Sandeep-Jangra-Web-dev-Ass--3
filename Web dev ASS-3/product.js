
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true
    },

    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      trim: true
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true
    },

    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"]
    },

    quantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer"
      }
    },

    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Threshold must be an integer"
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);