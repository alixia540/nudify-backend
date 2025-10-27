const Database = require("better-sqlite3");

// Ouvre ou crée une base locale
const db = new Database("nudify.db");

// Crée la table utilisateurs si elle n'existe pas encore
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    credits INTEGER DEFAULT 0
  )
`).run();

module.exports = db;
