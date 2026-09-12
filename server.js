require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const itemRoutes = require("./routes/items");

const app = express();

// =========================
// MIDDLEWARE
// =========================

app.use(cors());

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(express.json());

// =========================
// FRONTEND
// =========================

app.use(express.static("public"));

app.get(["/", "/login"], (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get(["/register", "/register.html"], (req, res) => {
  res.sendFile(__dirname + "/public/register.html");
});

app.get(["/home", "/home.html"], (req, res) => {
  res.sendFile(__dirname + "/public/home.html");
});

// =========================
// API ROUTES
// =========================

app.get("/api", (req, res) => {
  res.json({
    message: "FindBack API is running!"
  });
});

app.get("/test", (req, res) => {
  res.json({
    message: "Test route working!"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);

// Catch-all for undefined /api endpoints - ensures JSON response, NEVER HTML
app.use("/api", (req, res) => {
  res.status(404).json({
    message: "API endpoint not found",
    path: req.originalUrl || req.path
  });
});

// =========================
// DATABASE
// =========================

const net = require("net");

function isPortListening(host, port, timeout = 300) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let handled = false;
    socket.setTimeout(timeout);
    socket.on("connect", () => {
      handled = true;
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      if (!handled) {
        handled = true;
        socket.destroy();
        resolve(false);
      }
    });
    socket.on("error", () => {
      if (!handled) {
        handled = true;
        socket.destroy();
        resolve(false);
      }
    });
    socket.connect(port, host);
  });
}

mongoose.set("bufferCommands", false); // CRITICAL: fail fast, don't hang

async function initDatabase() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log("Using built-in persistent storage for FindBack");
    return;
  }

  const isLocal = mongoUri.includes("127.0.0.1") || mongoUri.includes("localhost");
  if (isLocal) {
    const isAvailable = await isPortListening("127.0.0.1", 27017, 300);
    if (!isAvailable) {
      console.log("Local MongoDB port 27017 not active — running with built-in storage");
      return;
    }
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2500 });
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.log("Running with built-in storage");
  }
}

initDatabase();

// CRITICAL route-level fallback: Add Express error middleware to handle database queries
// failing gracefully when MongoDB is offline:
app.use((err, req, res, next) => {
  if (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || (err.message && err.message.includes('buffering timed out'))) {
    if (req.method === 'GET') {
      return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
    }
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  // Ensure all API errors return JSON, never HTML
  if (req.path && req.path.startsWith('/api')) {
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error'
    });
  }

  next(err);
});

// =========================
// SERVER START
// =========================

const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;