import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

export function createMockD1(): any {
  const db = new DatabaseSync(":memory:");

  // Read migrations
  const m1 = fs.readFileSync("migrations/0001_auth_foundation.sql", "utf-8");
  const m3 = fs.readFileSync("migrations/0003_market_briefing_universe.sql", "utf-8");
  const m4 = fs.readFileSync("migrations/0004_market_briefing_v0.sql", "utf-8");
  const m8 = fs.readFileSync("migrations/0008_market_briefing_editorial.sql", "utf-8");
  const m9 = fs.readFileSync("migrations/0009_market_briefing_editorial_fixes.sql", "utf-8");

  const runSql = (sql: string) => {
    try {
      db.exec(sql);
    } catch (e) {
      console.error("Migration execution failed!", e);
      throw e;
    }
  };

  runSql(m1);
  runSql(m3);
  runSql(m4);
  runSql(m8);
  runSql(m9);

  class MockPreparedStatement {
    constructor(private stmt: any, private params: any[] = []) {}

    bind(...params: any[]) {
      return new MockPreparedStatement(this.stmt, params);
    }

    first() {
      try {
        return Promise.resolve(this.stmt.get(...this.params) || null);
      } catch (e) {
        return Promise.reject(e);
      }
    }

    all() {
      try {
        return Promise.resolve({ results: this.stmt.all(...this.params) });
      } catch (e) {
        return Promise.reject(e);
      }
    }

    run() {
      try {
        const info = this.stmt.run(...this.params);
        return Promise.resolve({ success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } });
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }

  return {
    prepare(query: string) {
      try {
        // Replace ? with standard sqlite bindings if needed, but node:sqlite supports ?
        const stmt = db.prepare(query);
        return new MockPreparedStatement(stmt);
      } catch (e) {
        console.error("Prepare error on:", query, e);
        throw e;
      }
    },
    batch(statements: MockPreparedStatement[]) {
      return Promise.all(statements.map(s => s.run()));
    },
    exec(query: string) {
      db.exec(query);
      return Promise.resolve();
    },
    // Test helper to verify schema
    _getColumns(table: string) {
      const stmt = db.prepare(`PRAGMA table_info(${table})`);
      return stmt.all();
    },
    _getTables() {
      const stmt = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`);
      return stmt.all();
    }
  };
}
