# Task 7: Debugging Exercise Walkthrough

In this exercise, a broken version of the server (`broken_server.js`) was provided by faculty containing 4 deliberate bugs commonly faced in backend engineering:
1. **Wrong Import Path** (`MODULE_NOT_FOUND`)
2. **Table-Name Typo** (`SQLITE_ERROR: no such table`)
3. **Missing `await`** (Pending Promise returned instead of query data)
4. **Port Conflict** (`Error: listen EADDRINUSE`)

---

## 🐛 Bug 1: Wrong Import Path (`MODULE_NOT_FOUND`)

### Error Symptom:
When executing `node debugging-exercise/broken_server.js`, Node immediately terminates on line 18:
```text
node:internal/modules/cjs/loader:1252
  throw err;
  ^

Error: Cannot find module './database'
Require stack:
- C:\Users\santh\...\broken_server.js
  code: 'MODULE_NOT_FOUND'
```

### Root Cause:
The server script tried to import `{ setupDatabase, dbPath }` from `./database`, but the file is named `initDb.js` and located in the parent directory (`../initDb.js`).

### The Fix:
Update the relative import path:
```javascript
// BEFORE (Broken):
const { setupDatabase, dbPath } = require("./database");

// AFTER (Fixed):
const { setupDatabase, dbPath } = require("../initDb");
```

---

## 🐛 Bug 2: Port Conflict (`EADDRINUSE`)

### Error Symptom:
If an instance of `server.js` is already running on port 3000, attempting to run another server on the same port crashes:
```text
events.js:377
      throw er; // Unhandled 'error' event
      ^

Error: listen EADDRINUSE: address already in use :::3000
    at Server.setupListenHandle [as _listen2] (net.js:1318:16)
    at listenInCluster (net.js:1366:12)
    at Server.listen (net.js:1452:7)
```

### Root Cause:
The port was hardcoded to `3000` (`const PORT = 3000;`). Operating systems allow only one socket process to bind to an address/port combination simultaneously.

### The Fix:
1. Make the port configurable via environment variables (`process.env.PORT || 3001`).
2. Attach an error listener to dynamically try the next available port or terminate gracefully:
```javascript
// BEFORE (Broken):
const PORT = 3000;
app.listen(PORT, ...);

// AFTER (Fixed):
let PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.warn(`Port ${PORT} in use. Retrying on port ${PORT + 1}...`);
        PORT += 1;
        server.listen(PORT);
    }
});
```

---

## 🐛 Bug 3: Table-Name Typo (`no such table`)

### Error Symptom:
When making a request `GET /books/`, the server returns a 500 error or logs:
```text
SQLITE_ERROR: no such table: bookss
```

### Root Cause:
The SQL query was written as `SELECT * FROM bookss` with a double 's', but the table created in SQLite was `book`.

### The Fix:
Correct the table name in the query:
```javascript
// BEFORE (Broken):
const getBooksQuery = `SELECT * FROM bookss WHERE title LIKE ? ...`;

// AFTER (Fixed):
const getBooksQuery = `SELECT * FROM book WHERE title LIKE ? ...`;
```

---

## 🐛 Bug 4: Missing `await` Keyword

### Error Symptom:
The API endpoint returns `{}` (empty JSON object) instead of the list of books:
```json
{}
```
If code attempts to do `books.map(...)` or `books.length`, it throws:
```text
TypeError: books.map is not a function
```

### Root Cause:
`db.all()` is an asynchronous function returning a `Promise`. Without the `await` keyword, JavaScript immediately assigns the pending `Promise` object to `books`. Express's `res.json(books)` serializes the Promise object into `{}` instead of waiting for the database query to resolve with the row array.

### The Fix:
Add `await` before `db.all()`:
```javascript
// BEFORE (Broken):
const books = db.all(getBooksQuery, [`%${search_q}%`]);

// AFTER (Fixed):
const books = await db.all(getBooksQuery, [`%${search_q}%`]);
```

---

## Summary of Solutions

| Bug | Error Message | Root Cause | Solution |
| :--- | :--- | :--- | :--- |
| **Import Path** | `Cannot find module './database'` | Incorrect relative path to DB module | Changed to `require("../initDb")` |
| **Port Conflict** | `listen EADDRINUSE: :::3000` | Port 3000 already bound by another process | Used `process.env.PORT \|\| 3001` + dynamic port retry |
| **Table Typo** | `SQLITE_ERROR: no such table: bookss` | Misspelled table name in query string | Corrected to `book` |
| **Missing `await`** | Returned `{}` / `books.map is not a function` | Asynchronous Promise was not awaited | Added `await db.all(...)` |
