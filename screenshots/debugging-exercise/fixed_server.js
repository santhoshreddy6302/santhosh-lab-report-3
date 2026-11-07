/**
 * FIXED SERVER - SOLUTION FOR TASK 7 DEBUGGING EXERCISE
 * 
 * All 4 bugs resolved:
 * 1. Correct import path: require("../initDb")
 * 2. Corrected table name: FROM book
 * 3. Added 'await' before db.all()
 * 4. Flexible port selection: process.env.PORT || 3001 with error handling for EADDRINUSE
 */

require("dotenv").config();
const express = require("express");
const path = require("path");

// =========================================================================
// FIX #1: Correct import path pointing to initDb
// =========================================================================
const { setupDatabase, dbPath } = require("../initDb");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
app.use(express.json());

let db = null;

// =========================================================================
// FIX #4: Configurable PORT via process.env or fallback to 3001 to prevent EADDRINUSE
// =========================================================================
let PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const initializeDBAndServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        await setupDatabase(db);

        const server = app.listen(PORT, () => {
            console.log(`[DEBUG EXERCISE] Server running at http://localhost:${PORT}/`);
        });

        // Handle EADDRINUSE port conflict dynamically
        server.on("error", (error) => {
            if (error.code === "EADDRINUSE") {
                console.warn(`Port ${PORT} is in use (EADDRINUSE). Retrying on port ${PORT + 1}...`);
                PORT += 1;
                server.listen(PORT);
            } else {
                console.error("Server error:", error);
            }
        });
    } catch (error) {
        console.error(`Database initialization error: ${error.message}`);
        process.exit(1);
    }
};

// =========================================================================
// FIX #2 & #3: Correct Table Name & Added Missing 'await'
// =========================================================================
app.get("/books/", async (req, res) => {
    try {
        const { search_q = "", order_by = "id", order = "ASC" } = req.query;

        // FIX #2: Correct table name is 'book', not 'bookss'
        const getBooksQuery = `
            SELECT * FROM book
            WHERE title LIKE ?
            ORDER BY id ASC;
        `;

        // FIX #3: Added 'await' so Promise resolves to rows array before sending response
        const books = await db.all(getBooksQuery, [`%${search_q}%`]);

        res.status(200).json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

if (require.main === module) {
    initializeDBAndServer();
}

module.exports = { app, initializeDBAndServer };
