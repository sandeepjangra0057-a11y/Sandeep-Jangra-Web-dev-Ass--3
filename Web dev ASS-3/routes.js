
const express = require("express");
const mongoose = require("mongoose");
const Product = require("./product");

const router = express.Router();

// 1. CREATE PRODUCT
router.post("/", async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// 2. GET ALL PRODUCTS: filtering, sorting, pagination
router.get("/", async (req, res, next) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sort = "createdAt",
      order = "desc",
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (
      !Number.isInteger(pageNum) || pageNum < 1 ||
      !Number.isInteger(limitNum) || limitNum < 1 ||
      limitNum > 100
    ) {
      return res.status(400).json({
        message: "Page must be positive; limit must be 1-100"
      });
    }

    const filter = {};

    if (category) filter.category = category;

    if (search) {
      filter.name = {
        $regex: search,
        $options: "i"
      };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};

      if (minPrice !== undefined) {
        filter.price.$gte = Number(minPrice);
      }

      if (maxPrice !== undefined) {
        filter.price.$lte = Number(maxPrice);
      }

      if (
        Object.values(filter.price).some(v => !Number.isFinite(v)) ||
        (filter.price.$gte !== undefined && filter.price.$gte < 0) ||
        (filter.price.$lte !== undefined && filter.price.$lte < 0) ||
        (filter.price.$gte !== undefined &&
         filter.price.$lte !== undefined &&
         filter.price.$gte > filter.price.$lte)
      ) {
        return res.status(400).json({
          message: "Invalid price range"
        });
      }
    }

    const allowedSort = [
      "name", "price", "quantity", "category", "createdAt"
    ];

    if (
      !allowedSort.includes(sort) ||
      !["asc", "desc"].includes(order)
    ) {
      return res.status(400).json({
        message: "Invalid sort field or order"
      });
    }

    const sortOption = {
      [sort]: order === "asc" ? 1 : -1
    };

    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum),

      Product.countDocuments(filter)
    ]);

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      products
    });
  } catch (err) {
    next(err);
  }
});

// 3. GET SINGLE PRODUCT BY ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    next(err);
  }
});

// 4. UPDATE PRODUCT DETAILS
router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const allowedFields = [
      "name", "sku", "category", "price",
      "quantity", "lowStockThreshold"
    ];

    const updates = {};

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided"
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    next(err);
  }
});

// 5. DELETE PRODUCT
router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// 6. RESTOCK PRODUCT
router.patch("/:id/restock", async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "Restock quantity must be a positive integer"
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { quantity } },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: "Stock increased successfully",
      product
    });
  } catch (err) {
    next(err);
  }
});

// 7. SELL PRODUCT: safely decrement stock
router.patch("/:id/sell", async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "Sale quantity must be a positive integer"
      });
    }

    const product = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        quantity: { $gte: quantity }
      },
      { $inc: { quantity: -quantity } },
      { new: true, runValidators: true }
    );

    if (!product) {
      const exists = await Product.exists({ _id: req.params.id });

      return res.status(exists ? 400 : 404).json({
        message: exists
          ? "Insufficient stock"
          : "Product not found"
      });
    }

    res.json({
      message: "Sale completed successfully",
      product
    });
  } catch (err) {
    next(err);
  }
});

// 8. LOW-STOCK REPORT
router.get("/reports/low-stock", async (req, res, next) => {
  try {
    const products = await Product.find({
      $expr: {
        $lte: ["$quantity", "$lowStockThreshold"]
      }
    });

    res.json({
      count: products.length,
      products
    });
  } catch (err) {
    next(err);
  }
});

// 9. CATEGORY-WISE INVENTORY SUMMARY
router.get("/reports/category-summary", async (req, res, next) => {
  try {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalInventoryValue: {
            $sum: { $multiply: ["$price", "$quantity"] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;