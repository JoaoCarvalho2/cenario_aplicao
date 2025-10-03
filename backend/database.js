// backend/database.js

const sqlite3 = require('sqlite3').verbose();
const DBSOURCE = "scenarios.db"; // Nome do arquivo do banco de dados

// Conecta ao banco de dados SQLite (cria o arquivo se não existir)
const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        // Habilita chaves estrangeiras
        db.run('PRAGMA foreign_keys = ON;', (err) => {
            if (err) {
                console.error("Erro ao habilitar chaves estrangeiras:", err.message);
            }
        });

        // Cria a tabela de cenários
        db.run(`CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            margin REAL DEFAULT 0.10,
            dollar_rate REAL DEFAULT 5.25,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error("Erro ao criar tabela de cenários:", err.message);
            }
        });

        // Cria a tabela de produtos, com uma chave estrangeira para o cenário
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scenario_id INTEGER,
            name TEXT,
            base_value REAL,
            FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
        )`, (err) => {
            if (err) {
                console.error("Erro ao criar tabela de produtos:", err.message);
            }
        });
    }
});

module.exports = db;