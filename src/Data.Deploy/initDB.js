const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Tables } = require('../Constants/Tables');
const settings = require('../settings.json').settings;
const SharedService = require('../Services/Common.Services/SharedService');

class DBInitializer {
  static _db = null;

  static async init() {
    if (!fs.existsSync(settings.dbPath)) {
      this._db = new sqlite3.Database(settings.dbPath);
      await this._runQuery('PRAGMA foreign_keys = ON');
      await this._runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.CONTRACTVERSION} (\
        Id INTEGER,\
        Version FLOAT NOT NULL,\
        Description TEXT,\
        CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,\
        LastUpdatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,\
        PRIMARY KEY(\"Id\" AUTOINCREMENT)\
      )`);
      await this._runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.SQLSCRIPTMIGRATIONS} (\
        Id INTEGER,\
        Sprint TEXT NOT NULL,\
        ScriptName TEXT NOT NULL,\
        ExecutedTimestamp TEXT,\
        ConcurrencyKey TEXT CHECK (ConcurrencyKey LIKE '0x%' AND length(ConcurrencyKey) = 18),\
        PRIMARY KEY(\"Id\" AUTOINCREMENT)\
      )`);
      await this._runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.PROPOSALS} (\
        Id INTEGER,\
        Title TEXT NOT NULL,\
        Description TEXT,\
        Options TEXT,\
        CreatorPubKey TEXT NOT NULL,\
        Deadline DATETIME,\
        Status TEXT DEFAULT 'Open',\
        CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,\
        LastUpdatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,\
        ConcurrencyKey TEXT CHECK (ConcurrencyKey LIKE '0x%' AND length(ConcurrencyKey) = 18),\
        PRIMARY KEY(\"Id\" AUTOINCREMENT)\
      )`);
      await this._runQuery(`CREATE TABLE IF NOT EXISTS ${Tables.VOTES} (\
        Id INTEGER,\
        ProposalId INTEGER NOT NULL,\
        VoterPubKey TEXT NOT NULL,\
        Choice TEXT NOT NULL,\
        Weight INTEGER DEFAULT 1,\
        CreatedOn DATETIME DEFAULT CURRENT_TIMESTAMP,\
        ConcurrencyKey TEXT CHECK (ConcurrencyKey LIKE '0x%' AND length(ConcurrencyKey) = 18),\
        PRIMARY KEY(\"Id\" AUTOINCREMENT),\
        UNIQUE(ProposalId, VoterPubKey)\
      )`);
      this._db.close();
    }

    if (fs.existsSync(settings.dbPath)) {
      this._db = new sqlite3.Database(settings.dbPath);
      const getLastExecutedSprintQuery = 'SELECT Sprint FROM SqlScriptMigrations ORDER BY Sprint DESC LIMIT 1';
      let rc = await this._getRecord(getLastExecutedSprintQuery);
      const lastExecutedSprint = rc ? rc.Sprint : 'Sprint_00';
      const scriptFolders = fs.readdirSync(settings.dbScriptsFolderPath).filter(f => f.startsWith('Sprint_') && f >= lastExecutedSprint).sort();
      for (const sprintFolder of scriptFolders) {
        const sprintFolderPath = path.join(settings.dbScriptsFolderPath, sprintFolder);
        const sqlFiles = fs.readdirSync(sprintFolderPath).filter(file => file.match(/^\d+_.+\.sql$/)).sort();
        for (const sqlFile of sqlFiles) {
          const scriptPath = path.join(sprintFolderPath, sqlFile);
          const query = 'SELECT * FROM SqlScriptMigrations WHERE Sprint = ? AND ScriptName = ?';
          const exists = await this._getRecord(query, [sprintFolder, sqlFile]);
          if (!exists) {
            const sqlScript = fs.readFileSync(scriptPath, 'utf8');
            const sqlStatements = sqlScript.split(';').map(statement => statement.split(/\?\
/).map(line => line.trim().startsWith('--') ? '' : line).join('\
')).filter(statement => statement.trim() !== '');
            for (const statement of sqlStatements) { try { await this._runQuery(statement); } catch (err) { /* log */ } }
            const insertQuery = 'INSERT INTO SqlScriptMigrations (Sprint, ScriptName, ExecutedTimestamp) VALUES (?, ?, ?)';
            await this._runQuery(insertQuery, [sprintFolder, sqlFile, SharedService.getCurrentTimestamp()]);
          }
        }
      }
      this._db.close();
    }
  }

  static _runQuery(query, params = null) {
    return new Promise((resolve, reject) => {
      this._db.run(query, params ? params : [], function(err) {
        if (err) return reject(err);
        resolve({ lastId: this.lastID, changes: this.changes });
      });
    });
  }

  static _getRecord(query, params = []) {
    return new Promise((resolve, reject) => {
      this._db.get(query, params, (err, row) => {
        if (err) return reject(err.message);
        resolve(row);
      });
    });
  }
}

module.exports = DBInitializer;
