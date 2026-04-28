import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_OPERATIONS = 50;
const LEGACY_KEY = '@ussd_history_v1';

export interface OperationRecord {
  id: string;
  service: 'palestine' | 'jawwal';
  type: string;
  amount?: string;
  recipientLast4?: string;
  date: string;
  status: 'success' | 'failed' | 'cancelled';
  refNumber?: string;
  description?: string;
}

const isWeb = Platform.OS === 'web';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (isWeb) return Promise.reject(new Error('SQLite not available on web'));
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('ussd_history.db').then(async db => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS operations (
          id TEXT PRIMARY KEY NOT NULL,
          service TEXT NOT NULL,
          type TEXT NOT NULL,
          amount TEXT,
          recipient_last4 TEXT,
          date TEXT NOT NULL,
          status TEXT NOT NULL,
          ref_number TEXT,
          description TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_ops_date ON operations(date DESC);
      `);
      await migrateLegacyData(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrateLegacyData(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const records: OperationRecord[] = JSON.parse(raw);
    if (!records.length) return;
    const stmt = await db.prepareAsync(
      `INSERT OR IGNORE INTO operations
        (id, service, type, amount, recipient_last4, date, status, ref_number, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    try {
      for (const r of records) {
        await stmt.executeAsync([
          r.id, r.service, r.type, r.amount ?? null, r.recipientLast4 ?? null,
          r.date, r.status, r.refNumber ?? null, r.description ?? null
        ]);
      }
    } finally {
      await stmt.finalizeAsync();
    }
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {}
}

function rowToRecord(row: Record<string, unknown>): OperationRecord {
  return {
    id: row.id as string,
    service: row.service as 'palestine' | 'jawwal',
    type: row.type as string,
    amount: (row.amount as string | null) ?? undefined,
    recipientLast4: (row.recipient_last4 as string | null) ?? undefined,
    date: row.date as string,
    status: row.status as 'success' | 'failed' | 'cancelled',
    refNumber: (row.ref_number as string | null) ?? undefined,
    description: (row.description as string | null) ?? undefined,
  };
}

async function fallbackSave(op: Omit<OperationRecord, 'id' | 'date'>): Promise<OperationRecord> {
  const all = await fallbackGetAll();
  const newOp: OperationRecord = {
    ...op, id: `${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
    date: new Date().toISOString(),
  };
  const updated = [newOp, ...all].slice(0, MAX_OPERATIONS);
  await AsyncStorage.setItem('@ussd_history_v2', JSON.stringify(updated));
  return newOp;
}

async function fallbackGetAll(): Promise<OperationRecord[]> {
  try {
    const data = await AsyncStorage.getItem('@ussd_history_v2');
    if (!data) return [];
    return JSON.parse(data) as OperationRecord[];
  } catch { return []; }
}

async function fallbackClear(): Promise<void> {
  await AsyncStorage.removeItem('@ussd_history_v2');
}

export const HistoryDb = {
  async save(op: Omit<OperationRecord, 'id' | 'date'>): Promise<OperationRecord> {
    if (isWeb) return fallbackSave(op);
    try {
      const db = await getDb();
      const newOp: OperationRecord = {
        ...op,
        id: `${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
        date: new Date().toISOString(),
      };
      await db.runAsync(
        `INSERT INTO operations
          (id, service, type, amount, recipient_last4, date, status, ref_number, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newOp.id, newOp.service, newOp.type, newOp.amount ?? null,
          newOp.recipientLast4 ?? null, newOp.date, newOp.status,
          newOp.refNumber ?? null, newOp.description ?? null,
        ]
      );
      await db.runAsync(
        `DELETE FROM operations WHERE id NOT IN (
          SELECT id FROM operations ORDER BY date DESC LIMIT ?
        )`,
        [MAX_OPERATIONS]
      );
      return newOp;
    } catch { return fallbackSave(op); }
  },

  async getAll(): Promise<OperationRecord[]> {
    if (isWeb) return fallbackGetAll();
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM operations ORDER BY date DESC LIMIT ?`,
        [MAX_OPERATIONS]
      );
      return rows.map(rowToRecord);
    } catch { return fallbackGetAll(); }
  },

  async clear(): Promise<void> {
    if (isWeb) return fallbackClear();
    try {
      const db = await getDb();
      await db.runAsync(`DELETE FROM operations`);
    } catch { await fallbackClear(); }
  },
};
