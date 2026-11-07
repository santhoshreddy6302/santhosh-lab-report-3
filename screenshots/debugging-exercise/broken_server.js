/**
 * BROKEN SERVER - FACULTY HANDOUT FOR TASK 7 DEBUGGING EXERCISE
 * 
 * This file contains 4 deliberate bugs commonly encountered in backend development:
 * 1. Wrong import path (Cannot find module)
 * 2. Table-name typo (SQL error: no such table)
 * 3. Missing await (Returns pending Promise instead of resolved rows)
 * 4. Port conflict (Error: listen EADDRINUSE)
 */

const express = require("express");
const path = require("path");

// =========================================================================
// BUG #1: WRONG IMPORT PATH
// Problem: The developer typed "./database" instead of "./initDb".
// Error: Error: Cannot find module './database'
// =========================================================================
const { setupDatabase, dbPath } = require("./database"); // <-- BUG 1: Wrong path! Should be "./initDb"
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
app.use(express.json());

let db = null;

// =========================================================================
// BUG #4 (Part A): PORT CONFLICT
// Problem: Hardcoding port 3000 when another instance is already running on port 3000
// Error: Error: listen EADDRINUSE: address already in use :::3000
// =========================================================================
const PORT = 3000; // <-- Hardcoded port without environment fallback or dynamic alternative

const initializeDBAndServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        await setupDatabase(db);

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}/`);
        });
    } catch (error) {
        console.error(`Database initialization error: ${error.message}`);
        process.exit(1);
    }
};

// =========================================================================
// BUG #2 & #3: TABLE-NAME TYPO & MISSING AWAIT
// =========================================================================
app.get("/books/", async (req, res) => {
    try {
        const { search_q = "", order_by = "id", order = "ASC" } = req.query;

        // BUG #2: Table-name typo ("bookss" instead of "book")
        // Error: SQLITE_ERROR: no such table: bookss
        const getBooksQuery = `
            SELECT * FROM bookss
            WHERE title LIKE ?
            ORDER BY ${order_by} ${order};
        `;

        // BUG #3: Missing 'await' before db.all()
        // Problem: db.all returns a Promise. Without await, 'books' is a pending Promise object
        // res.json(books) sends an empty object {} or crashes when inspecting
        const books = db.all(getBooksQuery, [`%${search_q}%`]); // <-- BUG 3: Missing 'await'!

        res.status(200).json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

initializeDBAndServer();
