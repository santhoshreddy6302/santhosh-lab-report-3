const express = require("express");
const sqlite3 = require("sqlite3");
const sqlite = require("sqlite");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Connect to your database
const dbPath = path.join(__dirname, "books.db");

let db;

// Initial 10 books dataset
const initialBooks = [
    { title: "The Alchemist", author: "Paulo Coelho", price: 250, pages: 208 },
    { title: "Atomic Habits", author: "James Clear", price: 450, pages: 320 },
    { title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", price: 300, pages: 336 },
    { title: "Wings of Fire", author: "A.P.J. Abdul Kalam", price: 200, pages: 180 },
    { title: "Ikigai", author: "Hector Garcia", price: 350, pages: 194 },
    { title: "Think Like a Monk", author: "Jay Shetty", price: 400, pages: 288 },
    { title: "Deep Work", author: "Cal Newport", price: 500, pages: 304 },
    { title: "The Power of Now", author: "Eckhart Tolle", price: 280, pages: 236 },
    { title: "Zero to One", author: "Peter Thiel", price: 320, pages: 210 },
    { title: "The 5 AM Club", author: "Robin Sharma", price: 380, pages: 336 }
];

// Validate book ID
const getValidBookId = (value) => {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

// Validate book details
const validateBook = (body) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return "Invalid request body.";
    }

    const { title, author, price, pages } = body;

    if (typeof title !== "string" || title.trim() === "") {
        return "Title is required.";
    }

    if (typeof author !== "string" || author.trim() === "") {
        return "Author is required.";
    }

    if (
        price === undefined ||
        price === null ||
        price === "" ||
        typeof price === "boolean" ||
        !Number.isFinite(Number(price))
    ) {
        return "Price must be a valid number.";
    }

    if (Number(price) < 0 || !Number.isInteger(Number(price))) {
        return "Price must be a non-negative integer.";
    }

    if (
        pages === undefined ||
        pages === null ||
        pages === "" ||
        typeof pages === "boolean" ||
        !Number.isInteger(Number(pages)) ||
        Number(pages) <= 0
    ) {
        return "Pages must be a positive integer.";
    }

    return null;
};

// Initialize database
const initializeDBAndServer = async (customPort = null) => {
    try {
        db = await sqlite.open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Ensure table exists
        await db.exec(`
            CREATE TABLE IF NOT EXISTS book (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                price INTEGER NOT NULL,
                pages INTEGER NOT NULL
            );
        `);

        // Check if table has data; if not, seed initial 10 records
        const countRow = await db.get("SELECT COUNT(*) AS count FROM book;");
        if (!countRow || countRow.count === 0) {
            console.log("Seeding initial 10 books into database...");
            const insertQuery = `
                INSERT INTO book (title, author, price, pages)
                VALUES (?, ?, ?, ?);
            `;
            for (const book of initialBooks) {
                await db.run(insertQuery, [book.title, book.author, book.price, book.pages]);
            }
            console.log("Database seeded successfully with 10 books.");
        }

        console.log("Database connected successfully.");

        const listenPort = customPort || PORT;
        return new Promise((resolve, reject) => {
            const server = app.listen(listenPort, () => {
                console.log(`Server running at http://localhost:${listenPort}`);
                resolve(server);
            });
            server.on("error", reject);
        });

    } catch (error) {
        console.error("Database error:", error.message);
        process.exit(1);
    }
};

// GET /books
// Search, sorting, price filtering and pagination
app.get("/books", async (req, res) => {
    try {
        const {
            search_q = "",
            order_by = "id",
            order = "ASC",
            limit = "10",
            offset = "0",
            min_price,
            max_price
        } = req.query;

        if (typeof search_q !== "string") {
            return res.status(400).json({
                message: "search_q must be a string."
            });
        }

        const allowedColumns = [
            "id", "title", "author", "price", "pages"
        ];

        if (!allowedColumns.includes(order_by)) {
            return res.status(400).json({
                message: "Invalid order_by column."
            });
        }

        const sortOrder = order.toUpperCase();
        if (sortOrder !== "ASC" && sortOrder !== "DESC") {
            return res.status(400).json({
                message: "Invalid order value. Allowed values: ASC, DESC."
            });
        }

        const pageLimit = parseInt(limit, 10);
        const pageOffset = parseInt(offset, 10);

        if (isNaN(pageLimit) || pageLimit < 1) {
            return res.status(400).json({
                message: "limit must be a positive integer."
            });
        }

        if (isNaN(pageOffset) || pageOffset < 0) {
            return res.status(400).json({
                message: "offset must be a non-negative integer."
            });
        }

        const conditions = [];
        const values = [];

        if (search_q) {
            conditions.push("title LIKE ?");
            values.push(`%${search_q}%`);
        }

        // Validate that min_price does not exceed max_price
        if (min_price !== undefined && max_price !== undefined) {
            if (parseInt(min_price, 10) > parseInt(max_price, 10)) {
                return res.status(400).json({
                    message: "Minimum price cannot exceed maximum price."
                });
            }
        }

        if (min_price !== undefined) {
            const minP = parseInt(min_price, 10);
            if (isNaN(minP)) {
                return res.status(400).json({
                    message: "min_price must be a number."
                });
            }
            conditions.push("price >= ?");
            values.push(minP);
        }

        if (max_price !== undefined) {
            const maxP = parseInt(max_price, 10);
            if (isNaN(maxP)) {
                return res.status(400).json({
                    message: "max_price must be a number."
                });
            }
            conditions.push("price <= ?");
            values.push(maxP);
        }

        let sql = "SELECT * FROM book";

        if (conditions.length > 0) {
            sql += " WHERE " + conditions.join(" AND ");
        }

        sql += ` ORDER BY ${order_by} ${sortOrder}`;
        sql += " LIMIT ? OFFSET ?";

        values.push(pageLimit, pageOffset);

        const books = await db.all(sql, values);

        return res.status(200).json({
            message: "Books retrieved successfully.",
            count: books.length,
            data: books
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Unable to retrieve books."
        });
    }
});

// GET /books/:bookId
// Get one book
app.get("/books/:bookId", async (req, res) => {
    try {
        const bookId = getValidBookId(req.params.bookId);

        if (!bookId) {
            return res.status(400).json({
                message: "Invalid book ID."
            });
        }

        const book = await db.get(
            "SELECT * FROM book WHERE id = ?",
            [bookId]
        );

        if (!book) {
            return res.status(404).json({
                message: "Book not found."
            });
        }

        return res.status(200).json(book);

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Unable to retrieve book."
        });
    }
});

// POST /books
// Create a new book
app.post("/books", async (req, res) => {
    try {
        const validationError = validateBook(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const { title, author, price, pages } = req.body;

        const result = await db.run(
            `INSERT INTO book (title, author, price, pages)
             VALUES (?, ?, ?, ?)`,
            [title.trim(), author.trim(), Number(price), Number(pages)]
        );

        const newBook = await db.get(
            "SELECT * FROM book WHERE id = ?",
            [result.lastID]
        );

        return res.status(201).json({
            message: "Book created successfully.",
            data: newBook
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Unable to add book."
        });
    }
});

// PUT /books/:bookId
// Update a book
app.put("/books/:bookId", async (req, res) => {
    try {
        const bookId = getValidBookId(req.params.bookId);

        if (!bookId) {
            return res.status(400).json({
                message: "Invalid book ID."
            });
        }

        const validationError = validateBook(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const existingBook = await db.get(
            "SELECT * FROM book WHERE id = ?",
            [bookId]
        );

        if (!existingBook) {
            return res.status(404).json({
                message: "Book not found."
            });
        }

        const { title, author, price, pages } = req.body;

        await db.run(
            `UPDATE book
             SET title = ?, author = ?, price = ?, pages = ?
             WHERE id = ?`,
            [title.trim(), author.trim(), Number(price), Number(pages), bookId]
        );

        const updatedBook = await db.get(
            "SELECT * FROM book WHERE id = ?",
            [bookId]
        );

        return res.status(200).json({
            message: "Book updated successfully.",
            data: updatedBook
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Unable to update book."
        });
    }
});

// DELETE /books/:bookId
// Delete a book
app.delete("/books/:bookId", async (req, res) => {
    try {
        const bookId = getValidBookId(req.params.bookId);

        if (!bookId) {
            return res.status(400).json({
                message: "Invalid book ID."
            });
        }

        const result = await db.run(
            "DELETE FROM book WHERE id = ?",
            [bookId]
        );

        if (result.changes === 0) {
            return res.status(404).json({
                message: "Book not found."
            });
        }

        return res.status(200).json({
            message: "Book deleted successfully."
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Unable to delete book."
        });
    }
});

// Unknown routes
app.use((req, res) => {
    res.status(404).json({
        message: "Route not found."
    });
});

// Start application if invoked directly
if (require.main === module) {
    initializeDBAndServer();
}

module.exports = { app, initializeDBAndServer };
