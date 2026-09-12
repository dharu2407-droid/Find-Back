const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const Item = require("../models/item");
const storage = require("./storage");

const router = express.Router();

const isDbConnected = () => mongoose.connection.readyState === 1;

// =========================
// IMAGE UPLOAD SETTINGS
// =========================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// =========================
// GET ALL / SEARCH ITEMS
// =========================

router.get("/", async (req, res) => {
  try {
    const {
      search,
      type,
      category,
      location
    } = req.query;

    if (isDbConnected()) {
      try {
        const query = {};

        if (type) {
          query.type = type;
        }

        if (category) {
          query.category = {
            $regex: category,
            $options: "i"
          };
        }

        if (location) {
          query.location = {
            $regex: location,
            $options: "i"
          };
        }

        if (search) {
          query.$or = [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } }
          ];
        }

        const items = await Item
          .find(query)
          .sort({ createdAt: -1 });

        return res.json({
          count: items.length,
          items: items
        });
      } catch (dbErr) {
        // fallback to storage
      }
    }

    // Local storage fallback
    let items = [...storage.getItems()];

    if (type) {
      items = items.filter(item => item.type === type);
    }

    if (category) {
      const catLower = category.toLowerCase();
      items = items.filter(item => item.category && item.category.toLowerCase().includes(catLower));
    }

    if (location) {
      const locLower = location.toLowerCase();
      items = items.filter(item => item.location && item.location.toLowerCase().includes(locLower));
    }

    if (search) {
      const sLower = search.toLowerCase();
      items = items.filter(item =>
        (item.title && item.title.toLowerCase().includes(sLower)) ||
        (item.description && item.description.toLowerCase().includes(sLower)) ||
        (item.category && item.category.toLowerCase().includes(sLower)) ||
        (item.location && item.location.toLowerCase().includes(sLower))
      );
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      count: items.length,
      items: items
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to load items"
    });
  }
});

// =========================
// POST ITEM
// =========================

router.post(
  "/",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.body) {
        return res.status(400).json({
          message: "No form data received."
        });
      }

      const {
        title,
        description,
        category,
        location,
        type,
        contactName,
        contactEmail,
        contactPhone
      } = req.body;

      if (
        !title ||
        !description ||
        !category ||
        !location ||
        !type ||
        !contactName ||
        !contactEmail ||
        !contactPhone
      ) {
        return res.status(400).json({
          message: "Please fill all required fields."
        });
      }

      // Convert uploaded file to base64 data URL if present, or use image URL/data from body
      let image = null;
      if (req.file && req.file.buffer) {
        const mime = req.file.mimetype || "image/jpeg";
        image = `data:${mime};base64,${req.file.buffer.toString("base64")}`;
      } else if (req.body.imageUrl && typeof req.body.imageUrl === "string" && req.body.imageUrl.trim()) {
        image = req.body.imageUrl.trim();
      } else if (req.body.image && typeof req.body.image === "string" && req.body.image.trim()) {
        image = req.body.image.trim();
      }

      if (isDbConnected()) {
        try {
          const item = await Item.create({
            title: title.trim(),
            description: description.trim(),
            category: category.trim(),
            location: location.trim(),
            type: type,
            image: image,
            contactName: contactName.trim(),
            contactEmail: contactEmail.trim().toLowerCase(),
            contactPhone: contactPhone.trim()
          });

          return res.status(201).json({
            message: "Item posted successfully!",
            item: item
          });
        } catch (dbErr) {
          // fallback to storage
        }
      }

      // Local storage fallback
      const newItem = storage.saveItem({
        _id: "item_" + Date.now(),
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        location: location.trim(),
        type: type,
        image: image,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        contactPhone: contactPhone.trim(),
        status: "active",
        createdAt: new Date().toISOString()
      });

      res.status(201).json({
        message: "Item posted successfully!",
        item: newItem
      });

    } catch (error) {
      res.status(400).json({
        message: error.message || "Failed to post item"
      });
    }
  }
);

module.exports = router;

