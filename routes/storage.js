const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "../data");

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // Read-only filesystem fallback
  }
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const ITEMS_FILE = path.join(DATA_DIR, "items.json");

const defaultUsers = [];
const defaultItems = [];

function loadJson(file, defaults) {
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    // fallback to defaults
  }
  return [...defaults];
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    // in case disk write fails in container
  }
}

let users = loadJson(USERS_FILE, defaultUsers);
let items = loadJson(ITEMS_FILE, defaultItems);

module.exports = {
  getUsers: () => users,
  saveUser: (user) => {
    users.push(user);
    saveJson(USERS_FILE, users);
    return user;
  },
  getItems: () => items,
  saveItem: (item) => {
    items.unshift(item);
    saveJson(ITEMS_FILE, items);
    return item;
  }
};
