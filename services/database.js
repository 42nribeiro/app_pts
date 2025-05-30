
const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

const db = new sqlite3.Database(config.SQLITE_DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDb();
  }
});

function initializeDb() {
  db.serialize(() => {
    // Planos Table
    db.run(`CREATE TABLE IF NOT EXISTS Planos (
      planUuid TEXT PRIMARY KEY,
      eventId TEXT,
      cliente TEXT,
      data TEXT, -- Store as ISO string (YYYY-MM-DD)
      hora TEXT, -- Store as HH:MM
      duracao TEXT,
      exercicios TEXT, -- JSON string
      status TEXT,
      cor TEXT,
      sessao TEXT,
      mes TEXT,
      mRef TEXT,
      avaliacaoData TEXT -- JSON string
    )`, (err) => {
      if (err) console.error("Error creating Planos table", err.message);
    });

    // Contas Table (Archived Plans)
    db.run(`CREATE TABLE IF NOT EXISTS Contas (
      idArquivo TEXT PRIMARY KEY,
      planUuidOriginal TEXT, -- Renamed from "ID Plano(Orig)" for clarity
      eventId TEXT,
      cliente TEXT,
      data TEXT, 
      hora TEXT,
      duracao TEXT,
      mRef TEXT,
      sessao TEXT,
      mes TEXT,
      exerciciosJSON TEXT,
      statusArq TEXT,
      cor TEXT,
      dataArq TEXT, -- Store as ISO string (YYYY-MM-DDTHH:MM:SS.SSSZ)
      avaliacaoJSON TEXT 
    )`, (err) => {
      if (err) console.error("Error creating Contas table", err.message);
    });

    // MasterExercises Table
    db.run(`CREATE TABLE IF NOT EXISTS MasterExercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      groupName TEXT NOT NULL,
      exerciseName TEXT NOT NULL,
      UNIQUE(groupName, exerciseName)
    )`, (err) => {
      if (err) console.error("Error creating MasterExercises table", err.message);
    });
  });
}

// Helper function to run a single query that doesn't return rows (INSERT, UPDATE, DELETE)
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { // Use function keyword to access this.lastID, this.changes
      if (err) {
        console.error('Error running sql ' + sql);
        console.error(err);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// Helper function to get a single row
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) {
        console.error('Error running sql: ' + sql);
        console.error(err);
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// Helper function to get all rows
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error running sql: ' + sql);
        console.error(err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = { 
    db,
    dbRun,
    dbGet,
    dbAll,
    initializeDb // Export for potential manual re-init or testing
};
