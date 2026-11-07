const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const dbPath = path.join(__dirname, "books.db");

const seedBooks = [
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

async function setupDatabase(existingDb = null) {
    const db = existingDb || await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS book (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            price INTEGER NOT NULL,
            pages INTEGER NOT NULL
        );
    `);

    const countRow = await db.get("SELECT COUNT(*) AS count FROM book;");
    if (countRow.count === 0) {
        console.log("Seeding initial 10 books into database...");
        const insertQuery = `
            INSERT INTO book (title, author, price, pages)
            VALUES (?, ?, ?, ?);
        `;
        for (const book of seedBooks) {
            await db.run(insertQuery, [book.title, book.author, book.price, book.pages]);
        }
        console.log("Database seeded successfully with 10 books.");
    } else {
        console.log(`Database already contains ${countRow.count} records.`);
    }

    return db;
}

// Allow direct execution: `node initDb.js`
if (require.main === module) {
    setupDatabase()
        .then((db) => {
            console.log("Database setup complete.");
            return db.close();
        })
        .catch((err) => {
            console.error("Error setting up database:", err);
            process.exit(1);
        });
}

module.exports = { setupDatabase, dbPath };
