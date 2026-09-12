
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/user");
const storage = require("./storage");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "findback_jwt_secret_dev_key";

const isDbConnected = () => mongoose.connection.readyState === 1;

router.get("/test", (req, res) => {
  res.json({ message: "Auth route working!" });
});

// GET /api/auth/me - Verify token and return current user details
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
    }

    let foundUser = null;
    if (isDbConnected()) {
      try {
        foundUser = await User.findById(decoded.userId).select("-password");
      } catch (dbErr) {
        // fallback to storage
      }
    }

    if (!foundUser) {
      const allUsers = storage.getUsers();
      foundUser = allUsers.find(
        (u) => u._id === decoded.userId || u.email.toLowerCase() === (decoded.email || "").toLowerCase()
      );
    }

    if (!foundUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: foundUser._id || foundUser.id,
        name: foundUser.name,
        email: foundUser.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (isDbConnected()) {
      try {
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
          return res.status(400).json({
            message: "User already exists with this email"
          });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword
        });

        const token = jwt.sign(
          {
            userId: user._id,
            email: user.email
          },
          JWT_SECRET,
          {
            expiresIn: "7d"
          }
        );

        return res.status(201).json({
          message: "User registered successfully",
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email
          }
        });
      } catch (dbErr) {
        // fallback to storage
      }
    }

    // Local storage fallback
    const allUsers = storage.getUsers();
    const existing = allUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      return res.status(400).json({
        message: "User already exists with this email"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = storage.saveUser({
      _id: "user_" + Date.now(),
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    const token = jwt.sign(
      {
        userId: newUser._id,
        email: newUser.email
      },
      JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let foundUser = null;

    if (isDbConnected()) {
      try {
        foundUser = await User.findOne({ email: normalizedEmail });
      } catch (dbErr) {
        // fallback to storage
      }
    }

    if (!foundUser) {
      const allUsers = storage.getUsers();
      foundUser = allUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    }

    if (!foundUser) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const passwordMatch = await bcrypt.compare(password, foundUser.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        userId: foundUser._id,
        email: foundUser.email
      },
      JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: foundUser._id,
        name: foundUser.name,
        email: foundUser.email
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;

