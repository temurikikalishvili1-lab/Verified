const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'app.db');

// Create and connect to database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database with tables
function initializeDatabase() {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Transactions table (for send money functionality)
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users (id),
        FOREIGN KEY (receiver_id) REFERENCES users (id)
    )`);

    // Support tickets table
    db.run(`CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    console.log('Database tables initialized successfully');
}

// User functions
function createUser(userData, callback) {
    const { fullname, email, phone, password } = userData;
    const sql = `INSERT INTO users (fullname, email, phone, password) VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [fullname, email, phone, password], function(err) {
        callback(err, this.lastID);
    });
}

function getUserByEmail(email, callback) {
    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], callback);
}

function getUserById(id, callback) {
    const sql = `SELECT * FROM users WHERE id = ?`;
    db.get(sql, [id], callback);
}

// Transaction functions
function createTransaction(transactionData, callback) {
    const { sender_id, receiver_id, amount, currency } = transactionData;
    const sql = `INSERT INTO transactions (sender_id, receiver_id, amount, currency) VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [sender_id, receiver_id, amount, currency], function(err) {
        callback(err, this.lastID);
    });
}

function getTransactionsByUserId(userId, callback) {
    const sql = `SELECT * FROM transactions WHERE sender_id = ? OR receiver_id = ? ORDER BY created_at DESC`;
    db.all(sql, [userId, userId], callback);
}

// Support ticket functions
function createSupportTicket(ticketData, callback) {
    const { user_id, subject, message } = ticketData;
    const sql = `INSERT INTO support_tickets (user_id, subject, message) VALUES (?, ?, ?)`;
    
    db.run(sql, [user_id, subject, message], function(err) {
        callback(err, this.lastID);
    });
}

function getSupportTicketsByUserId(userId, callback) {
    const sql = `SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC`;
    db.all(sql, [userId], callback);
}

// Close database connection
function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
    });
}

module.exports = {
    db,
    createUser,
    getUserByEmail,
    getUserById,
    createTransaction,
    getTransactionsByUserId,
    createSupportTicket,
    getSupportTicketsByUserId,
    closeDatabase
};
