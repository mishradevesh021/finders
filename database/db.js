const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, 'finders.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance = null;

function getDB() {
    if (!dbInstance) {
        dbInstance = new DatabaseSync(DB_PATH);
        dbInstance.exec('PRAGMA foreign_keys = ON;');
        initSchema(dbInstance);
    }
    return dbInstance;
}

function initSchema(db) {
    if (fs.existsSync(SCHEMA_PATH)) {
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schema);
    }
    // Safe auto-creation of form_submissions if not present
    db.exec(`
        CREATE TABLE IF NOT EXISTS form_submissions (
            id TEXT PRIMARY KEY,
            form_type TEXT NOT NULL,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            city TEXT DEFAULT 'Bengaluru',
            locality TEXT,
            service_needed TEXT,
            budget REAL,
            message TEXT,
            status TEXT NOT NULL DEFAULT 'NEW',
            notes TEXT,
            raw_data_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

// Database helper functions
const db = {
    get: (sql, params = []) => {
        const d = getDB();
        const stmt = d.prepare(sql);
        return stmt.get(...params);
    },
    all: (sql, params = []) => {
        const d = getDB();
        const stmt = d.prepare(sql);
        return stmt.all(...params);
    },
    run: (sql, params = []) => {
        const d = getDB();
        const stmt = d.prepare(sql);
        return stmt.run(...params);
    },
    exec: (sql) => {
        const d = getDB();
        return d.exec(sql);
    },
    rawDB: getDB
};

module.exports = db;
