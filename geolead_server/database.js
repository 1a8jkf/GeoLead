const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conecta ou cria o banco de dados SQLite
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        db.run(`CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            device_id TEXT,
            status TEXT NOT NULL DEFAULT 'paid',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

module.exports = db;
