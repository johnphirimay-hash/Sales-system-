const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();

// Replit-safe port
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Connect to SQLite database
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      total_cost REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      product_id INTEGER,
      product_name TEXT,
      quantity INTEGER,
      price REAL,
      total REAL,
      profit REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
});

// -------------------- ROUTES --------------------

// Root test
app.get("/", (req, res) => {
  res.send("Server is running successfully.");
});

// Register shop
app.post("/register", (req, res) => {
  const { shop_name, email, password } = req.body;
  if (!shop_name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const query = `INSERT INTO shops (shop_name, email, password) VALUES (?, ?, ?)`;
  db.run(query, [shop_name, email, password], function (err) {
    if (err) {
      console.error("Registration error:", err.message);
      return res.status(500).json({ error: "Registration failed" });
    }
    res.json({ message: "Shop registered successfully", shop_id: this.lastID });
  });
});

// Login shop
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM shops WHERE email = ? AND password = ?", [email, password], (err, row) => {
    if (err) return res.status(500).json({ error: "Login failed" });
    if (!row) return res.status(400).json({ error: "Invalid credentials" });
    res.json({ message: "Login successful", shop_id: row.id, shop_name: row.shop_name });
  });
});

// Add product
app.post("/add-product", (req, res) => {
  const { shop_id, product_name, quantity, total_cost } = req.body;
  if (!shop_id || !product_name || !quantity || !total_cost) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const query = `INSERT INTO products (shop_id, product_name, quantity, total_cost) VALUES (?, ?, ?, ?)`;
  db.run(query, [shop_id, product_name, quantity, total_cost], function(err) {
    if (err) {
      console.error("Add product error:", err.message);
      return res.status(500).json({ error: "Failed to add product" });
    }
    res.json({ success: true, product_id: this.lastID });
  });
});

// Get products for a shop
app.get("/shop-products/:shop_id", (req, res) => {
  const shop_id = req.params.shop_id;
  db.all("SELECT * FROM products WHERE shop_id = ?", [shop_id], (err, rows) => {
    if (err) {
      console.error("Fetch products error:", err.message);
      return res.status(500).json([]);
    }
    res.json(rows);
  });
});

// Record sale
app.post("/record-sale", (req, res) => {
  const { shop_id, product_id, product_name, quantity, price, total, profit } = req.body;
  if (!shop_id || !product_id || !product_name || !quantity || !price || !total) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const query = `INSERT INTO sales (shop_id, product_id, product_name, quantity, price, total, profit)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(query, [shop_id, product_id, product_name, quantity, price, total, profit], function(err) {
    if (err) {
      console.error("Record sale error:", err.message);
      return res.status(500).json({ error: "Error recording sale" });
    }
    res.json({ message: "Sale recorded successfully", sale_id: this.lastID });
  });
});

// Dashboard summary
app.get("/dashboard/:shop_id", (req, res) => {
  const shop_id = req.params.shop_id;
  const query = `
    SELECT COUNT(*) as total_sales, SUM(total) as total_revenue, SUM(profit) as total_profit
    FROM sales
    WHERE shop_id = ?
  `;
  db.get(query, [shop_id], (err, row) => {
    if (err) {
      console.error("Dashboard fetch error:", err.message);
      return res.status(500).json({ error: "Error fetching dashboard" });
    }
    res.json({
      total_sales: row.total_sales || 0,
      total_revenue: row.total_revenue || 0,
      total_profit: row.total_profit || 0
    });
  });
});

// Get all sales for a shop
app.get("/sales/:shop_id", (req, res) => {
  const shop_id = req.params.shop_id;
  const query = `SELECT * FROM sales WHERE shop_id = ? ORDER BY created_at DESC`;
  db.all(query, [shop_id], (err, rows) => {
    if (err) {
      console.error("Fetch sales error:", err.message);
      return res.status(500).json([]);
    }
    res.json(rows);
  });
});

// Serve HTML pages
app.get("/register.html", (req, res) => res.sendFile(path.join(__dirname, "public", "register.html")));
app.get("/login.html", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/products.html", (req, res) => res.sendFile(path.join(__dirname, "public", "products.html")));
app.get("/sales.html", (req, res) => res.sendFile(path.join(__dirname, "public", "sales.html")));
app.get("/dashboard.html", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});