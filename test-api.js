/**
 * Automated Test Suite for Lab 3 API
 * Matches server.js response format:
 * GET /books -> { message, count, data }
 * POST /books -> { message, data }
 * PUT /books/:id -> { message, data }
 * DELETE /books/:id -> { message }
 */
const { initializeDBAndServer } = require("./server");

const BASE_URL = "http://127.0.0.1:3000";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runTest(name, fn) {
    try {
        await fn();
        console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
        testsPassed++;
    } catch (error) {
        console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${name}`);
        console.error(`    → ${error.message}`);
        testsFailed++;
    }
}

async function startTests() {
    console.log("==================================================");
    console.log("       Lab 3 Automated Test Suite Execution       ");
    console.log("==================================================\n");

    const server = await initializeDBAndServer();

    try {
        console.log("--- 1. Query Parameters & GET /books ---");

        await runTest("GET /books returns default list of books (Status 200)", async () => {
            const res = await fetch(`${BASE_URL}/books`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const json = await res.json();
            assert(Array.isArray(json.data), "Expected data array");
            assert(json.count === json.data.length, "Count should match data length");
            assert(json.data.length > 0, "Expected non-empty array");
        });

        await runTest("GET /books?search_q=The matches title partially (LIKE)", async () => {
            const res = await fetch(`${BASE_URL}/books?search_q=The`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const json = await res.json();
            assert(json.data.some((b) => b.title.includes("The")), "Expected 'The' in results");
        });

        await runTest("GET /books?order_by=price&order=DESC sorts descending", async () => {
            const res = await fetch(`${BASE_URL}/books?order_by=price&order=DESC`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const json = await res.json();
            for (let i = 1; i < json.data.length; i++) {
                assert(json.data[i - 1].price >= json.data[i].price, "Books should be sorted by price descending");
            }
        });

        await runTest("GET /books?min_price=200&max_price=350 filters by price range", async () => {
            const res = await fetch(`${BASE_URL}/books?min_price=200&max_price=350`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const json = await res.json();
            for (const b of json.data) {
                assert(b.price >= 200 && b.price <= 350, `Price ${b.price} not between 200 and 350`);
            }
        });

        await runTest("GET /books?limit=5&offset=0 applies pagination", async () => {
            const res = await fetch(`${BASE_URL}/books?limit=5&offset=0`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const json = await res.json();
            assert(json.data.length <= 5, `Expected at most 5 books, got ${json.data.length}`);
        });

        await runTest("GET /books?order_by=invalid_col returns 400 Bad Request", async () => {
            const res = await fetch(`${BASE_URL}/books?order_by=invalid_col`);
            assert(res.status === 400, `Expected 400, got ${res.status}`);
            const json = await res.json();
            assert(json.message === "Invalid order_by column.", "Expected invalid order_by message");
        });

        await runTest("GET /books?min_price=500&max_price=200 returns 400 for inverted range", async () => {
            const res = await fetch(`${BASE_URL}/books?min_price=500&max_price=200`);
            assert(res.status === 400, `Expected 400, got ${res.status}`);
            const json = await res.json();
            assert(json.message === "Minimum price cannot exceed maximum price.", "Expected range error");
        });

        console.log("\n--- 2. Single Resource GET /books/:bookId ---");

        await runTest("GET /books/:bookId returns existing book (Status 200)", async () => {
            const res = await fetch(`${BASE_URL}/books/1`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const data = await res.json();
            assert(data.id === 1, "Expected book with ID 1");
        });

        await runTest("GET /books/:bookId with non-existent ID returns 404", async () => {
            const res = await fetch(`${BASE_URL}/books/999999`);
            assert(res.status === 404, `Expected 404, got ${res.status}`);
            const data = await res.json();
            assert(data.message === "Book not found.", "Expected 'Book not found.' message");
        });

        console.log("\n--- 3. Validation & POST /books ---");

        let createdId = null;
        await runTest("POST /books creates new book (Status 201)", async () => {
            const newBook = {
                title: "C++ Programming",
                author: "Bjarne Stroustrup",
                price: 600,
                pages: 450
            };
            const res = await fetch(`${BASE_URL}/books`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newBook)
            });
            assert(res.status === 201, `Expected 201, got ${res.status}`);
            const json = await res.json();
            assert(json.data && json.data.id, "Expected created book with id");
            createdId = json.data.id;
        });

        await runTest("POST /books rejects missing title with 400", async () => {
            const res = await fetch(`${BASE_URL}/books`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ author: "Some Author", price: 300, pages: 200 })
            });
            assert(res.status === 400, `Expected 400, got ${res.status}`);
            const json = await res.json();
            assert(json.message === "Title is required.", "Expected title required error");
        });

        await runTest("POST /books rejects missing author with 400", async () => {
            const res = await fetch(`${BASE_URL}/books`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: "Some Title", price: 300, pages: 200 })
            });
            assert(res.status === 400, `Expected 400, got ${res.status}`);
            const json = await res.json();
            assert(json.message === "Author is required.", "Expected author required error");
        });

        await runTest("POST /books rejects non-numeric price with 400", async () => {
            const res = await fetch(`${BASE_URL}/books`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: "Some Title", author: "Some Author", price: "free", pages: 200 })
            });
            assert(res.status === 400, `Expected 400, got ${res.status}`);
            const json = await res.json();
            assert(json.message === "Price must be a valid number.", "Expected price validation error");
        });

        console.log("\n--- 4. Update PUT /books/:bookId ---");

        await runTest("PUT /books/:bookId updates existing book (Status 200)", async () => {
            assert(createdId, "Need createdId for update");
            const updated = {
                title: "C++ Programming Updated",
                author: "Bjarne Stroustrup",
                price: 650,
                pages: 500
            };
            const res = await fetch(`${BASE_URL}/books/${createdId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updated)
            });
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const json = await res.json();
            assert(json.message === "Book updated successfully.", "Expected update confirmation");
        });

        await runTest("PUT /books/999999 returns 404 for non-existent book", async () => {
            const res = await fetch(`${BASE_URL}/books/999999`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: "Ghost", author: "Nobody", price: 100, pages: 100 })
            });
            assert(res.status === 404, `Expected 404, got ${res.status}`);
        });

        console.log("\n--- 5. Delete DELETE /books/:bookId ---");

        await runTest("DELETE /books/:bookId deletes existing book (Status 200)", async () => {
            assert(createdId, "Need createdId for delete");
            const res = await fetch(`${BASE_URL}/books/${createdId}`, {
                method: "DELETE"
            });
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            const json = await res.json();
            assert(json.message === "Book deleted successfully.", "Expected delete confirmation");
        });

        await runTest("DELETE /books/999999 returns 404 for non-existent book", async () => {
            const res = await fetch(`${BASE_URL}/books/999999`, {
                method: "DELETE"
            });
            assert(res.status === 404, `Expected 404, got ${res.status}`);
        });

        console.log("\n--- 6. Undefined Route Handler ---");

        await runTest("GET /unknown returns 404 with JSON message", async () => {
            const res = await fetch(`${BASE_URL}/invalid-endpoint`);
            assert(res.status === 404, `Expected 404, got ${res.status}`);
            const data = await res.json();
            assert(data.message === "Route not found.", "Expected 'Route not found.'");
        });

    } finally {
        server.close();
    }

    console.log("\n==================================================");
    console.log(`Test Results: ${testsPassed} passed, ${testsFailed} failed`);
    console.log("==================================================");

    if (testsFailed > 0) {
        process.exit(1);
    }
}

startTests().catch((err) => {
    console.error("Test runner failed unexpectedly:", err);
    process.exit(1);
});
