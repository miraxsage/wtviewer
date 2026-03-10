import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { getDataDir } from "./dataPath";

function ensureDataDirs() {
  for (const dir of ["chats", "media", "backups"]) {
    fs.mkdirSync(path.join(getDataDir(), dir), { recursive: true });
  }
}

export function getMainDb(): Database.Database {
  ensureDataDirs();
  const db = new Database(path.join(getDataDir(), "main.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      source_type TEXT NOT NULL CHECK(source_type IN ('whatsapp', 'telegram')),
      participants TEXT DEFAULT '[]',
      message_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      backup_path TEXT DEFAULT '',
      media_dir TEXT DEFAULT '',
      participant_details TEXT DEFAULT '{}',
      show_own_sender INTEGER DEFAULT 0
    )
  `);
  // For existing DBs that already have the table without new columns
  try {
    db.exec(`ALTER TABLE chats ADD COLUMN participant_details TEXT DEFAULT '{}'`);
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec(`ALTER TABLE chats ADD COLUMN show_own_sender INTEGER DEFAULT 0`);
  } catch {
    // Column already exists — ignore
  }
  return db;
}

export function getChatDb(chatId: string): Database.Database {
  ensureDataDirs();
  const dbPath = path.join(getDataDir(), "chats", `${chatId}.db`);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_index INTEGER NOT NULL,
      sender TEXT NOT NULL,
      datetime TEXT NOT NULL,
      content TEXT DEFAULT '',
      media_type TEXT DEFAULT 'text',
      media_path TEXT,
      is_favorite INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_index);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
    CREATE INDEX IF NOT EXISTS idx_messages_datetime ON messages(datetime);
    CREATE INDEX IF NOT EXISTS idx_messages_favorite ON messages(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_messages_media_type ON messages(media_type);
  `);
  return db;
}

export function deleteChatDb(chatId: string) {
  const dbPath = path.join(getDataDir(), "chats", `${chatId}.db`);
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const walPath = dbPath + "-wal";
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  const shmPath = dbPath + "-shm";
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}
