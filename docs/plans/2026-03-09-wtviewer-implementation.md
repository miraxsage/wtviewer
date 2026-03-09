# WTViewer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js web app for viewing exported WhatsApp and Telegram chat histories with SQLite storage, virtual scrolling, media playback, and archive import.

**Architecture:** Next.js 16 App Router with server-side SQLite (better-sqlite3) for data storage. Separate SQLite DB per chat for performance. Server API routes handle import/parsing, client uses React Virtuoso for virtual scrolling of messages. Media files served via API route from organized local directories.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, better-sqlite3, React Virtuoso, Zustand, JSZip, node-unrar-js, Cheerio, uuid

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Step 1: Initialize Next.js project**

Run:
```bash
cd /Users/miraxsage/dev/wtviewer
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-npm
```

**Step 2: Install dependencies**

Run:
```bash
npm install better-sqlite3 react-virtuoso zustand jszip node-unrar-js cheerio uuid
npm install -D @types/better-sqlite3 @types/uuid
```

**Step 3: Create data directories**

Run:
```bash
mkdir -p data/chats data/media data/backups
echo "data/" >> .gitignore
```

**Step 4: Configure next.config.ts for native modules**

In `next.config.ts`, add:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
```

**Step 5: Verify dev server starts**

Run: `npm run dev`
Expected: Server starts on localhost:3000

**Step 6: Commit**

```bash
git init && git add -A && git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: Database Layer

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/types.ts`

**Step 1: Create shared types**

Create `src/lib/types.ts`:
```typescript
export interface Chat {
  id: string;
  name: string;
  description: string;
  source_type: "whatsapp" | "telegram";
  participants: string[];
  message_count: number;
  created_at: string;
  backup_path: string;
  media_dir: string;
}

export interface Message {
  id: number;
  order_index: number;
  sender: string;
  datetime: string;
  content: string;
  media_type: "text" | "image" | "video" | "audio" | "voice" | "sticker" | "gif" | "document";
  media_path: string | null;
  is_favorite: number;
  is_hidden: number;
}

export interface MessagesQuery {
  offset?: number;
  limit?: number;
  sender?: string;
  search?: string;
  favorites?: boolean;
}
```

**Step 2: Create database module**

Create `src/lib/db.ts`:
```typescript
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const MAIN_DB_PATH = path.join(DATA_DIR, "main.db");

function ensureDataDirs() {
  for (const dir of ["chats", "media", "backups"]) {
    fs.mkdirSync(path.join(DATA_DIR, dir), { recursive: true });
  }
}

export function getMainDb(): Database.Database {
  ensureDataDirs();
  const db = new Database(MAIN_DB_PATH);
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
      media_dir TEXT DEFAULT ''
    )
  `);
  return db;
}

export function getChatDb(chatId: string): Database.Database {
  ensureDataDirs();
  const dbPath = path.join(DATA_DIR, "chats", `${chatId}.db`);
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
  `);
  return db;
}

export function deleteChatDb(chatId: string) {
  const dbPath = path.join(DATA_DIR, "chats", `${chatId}.db`);
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const walPath = dbPath + "-wal";
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  const shmPath = dbPath + "-shm";
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add database layer with main and per-chat SQLite"
```

---

## Task 3: WhatsApp Parser

**Files:**
- Create: `src/lib/parsers/whatsapp.ts`

**Step 1: Create WhatsApp parser**

Create `src/lib/parsers/whatsapp.ts`:

The parser must handle:
- Message format: `DD.MM.YYYY, HH:MM - Sender: message text`
- Multi-line messages (continuation lines without date prefix)
- File attachments: `‎filename.ext (файл добавлен)` pattern
- System messages (no sender, just `DD.MM.YYYY, HH:MM - system text`)
- Media type detection by file prefix/extension:
  - `PTT-*.opus` / `AUD-*.opus` → voice
  - `AUD-*.mp3` / `AUD-*.m4a` → audio
  - `IMG-*.jpg` / `IMG-*.jpeg` / `IMG-*.png` / `IMG-*.webp` → image
  - `VID-*.mp4` / `VID-*.3gp` → video
  - `STK-*.webp` → sticker

```typescript
import { Message } from "../types";

const MESSAGE_REGEX = /^(\d{2}\.\d{2}\.\d{4}), (\d{2}:\d{2}) - (.+)$/;
const SENDER_REGEX = /^([^:]+): (.*)$/s;
const FILE_ATTACHED_REGEX = /^\u200e?(.+?) \(файл добавлен\)$/;

export function parseWhatsAppChat(text: string): { messages: Message[]; participants: Set<string> } {
  const lines = text.split("\n");
  const messages: Message[] = [];
  const participants = new Set<string>();
  let currentMessage: { date: string; time: string; sender: string; content: string } | null = null;
  let orderIndex = 0;

  function flushMessage() {
    if (!currentMessage) return;
    const { date, time, sender, content } = currentMessage;
    if (!sender) return; // skip system messages

    participants.add(sender);
    const [day, month, year] = date.split(".");
    const datetime = `${year}-${month}-${day}T${time}:00`;

    const fileMatch = content.match(FILE_ATTACHED_REGEX);
    let mediaType: Message["media_type"] = "text";
    let mediaPath: string | null = null;
    let messageContent = content;

    if (fileMatch) {
      const filename = fileMatch[1];
      mediaPath = filename;
      mediaType = detectMediaType(filename);
      messageContent = "";
    }

    messages.push({
      id: 0,
      order_index: orderIndex++,
      sender,
      datetime,
      content: messageContent,
      media_type: mediaType,
      media_path: mediaPath,
      is_favorite: 0,
      is_hidden: 0,
    });
  }

  for (const line of lines) {
    const msgMatch = line.match(MESSAGE_REGEX);
    if (msgMatch) {
      flushMessage();
      const [, date, time, rest] = msgMatch;
      const senderMatch = rest.match(SENDER_REGEX);
      if (senderMatch) {
        currentMessage = { date, time, sender: senderMatch[1], content: senderMatch[2] };
      } else {
        // system message
        currentMessage = { date, time, sender: "", content: rest };
      }
    } else if (currentMessage) {
      currentMessage.content += "\n" + line;
    }
  }
  flushMessage();

  return { messages, participants };
}

function detectMediaType(filename: string): Message["media_type"] {
  const lower = filename.toLowerCase();
  if (/^ptt-.*\.(opus|ogg)$/.test(lower)) return "voice";
  if (/^aud-.*\.(opus|ogg)$/.test(lower)) return "voice";
  if (/^aud-.*\.(mp3|m4a|aac|wav)$/.test(lower)) return "audio";
  if (/\.(mp3|m4a|aac|wav)$/.test(lower)) return "audio";
  if (/^img-.*\.(jpg|jpeg|png|webp)$/.test(lower)) return "image";
  if (/\.(jpg|jpeg|png|webp)$/.test(lower)) return "image";
  if (/\.(gif)$/.test(lower)) return "gif";
  if (/^vid-.*\.(mp4|3gp|mov|avi)$/.test(lower)) return "video";
  if (/\.(mp4|3gp|mov|avi)$/.test(lower)) return "video";
  if (/^stk-.*\.webp$/.test(lower)) return "sticker";
  return "document";
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add WhatsApp chat parser"
```

---

## Task 4: Telegram Parser

**Files:**
- Create: `src/lib/parsers/telegram.ts`

**Step 1: Create Telegram parser**

Create `src/lib/parsers/telegram.ts`:

The parser must handle:
- Multiple HTML files: `messages.html`, `messages2.html`, ..., `messages10.html`
- Message structure: `.message.default` divs with `.from_name`, `.date.details` (title attr has full timestamp), `.text`
- Joined messages (`.message.default.joined`) — same sender, no `.from_name`, use previous sender
- Media types: `.media_voice_message` (href to .ogg), `.photo_wrap` (href to .jpg), `.video_file_wrap` or `.media_video_file`, `.sticker_wrap`, `.animated_wrap`
- Sort files numerically: messages.html=1, messages2.html=2, etc.

```typescript
import * as cheerio from "cheerio";
import { Message } from "../types";

export function parseTelegramChat(htmlFiles: { name: string; content: string }[]): {
  messages: Message[];
  participants: Set<string>;
} {
  // Sort files: messages.html first, then messages2, messages3, etc.
  const sorted = htmlFiles.sort((a, b) => {
    const numA = extractPageNumber(a.name);
    const numB = extractPageNumber(b.name);
    return numA - numB;
  });

  const messages: Message[] = [];
  const participants = new Set<string>();
  let orderIndex = 0;
  let lastSender = "";

  for (const file of sorted) {
    const $ = cheerio.load(file.content);

    $(".message.default").each((_, el) => {
      const $msg = $(el);

      // Sender
      const fromName = $msg.find(".from_name").first().text().trim();
      if (fromName) {
        lastSender = fromName;
      }
      const sender = lastSender;
      if (sender) participants.add(sender);

      // Date
      const dateTitle = $msg.find(".date.details").attr("title") || "";
      const datetime = parseTelegramDate(dateTitle);

      // Text content
      const text = $msg.find(".text").first().text().trim();

      // Media detection
      let mediaType: Message["media_type"] = "text";
      let mediaPath: string | null = null;

      const voiceLink = $msg.find("a.media_voice_message").attr("href");
      const photoLink = $msg.find("a.photo_wrap").attr("href");
      const videoLink = $msg.find("a.video_file_wrap").attr("href")
        || $msg.find("a.media_video_file").attr("href");
      const stickerLink = $msg.find("a.sticker_wrap").attr("href");
      const animatedLink = $msg.find("a.animated_wrap").attr("href");

      if (voiceLink) {
        mediaType = "voice";
        mediaPath = voiceLink;
      } else if (photoLink) {
        mediaType = "image";
        mediaPath = photoLink;
      } else if (stickerLink) {
        mediaType = "sticker";
        mediaPath = stickerLink;
      } else if (animatedLink) {
        mediaType = "gif";
        mediaPath = animatedLink;
      } else if (videoLink) {
        mediaType = "video";
        mediaPath = videoLink;
      }

      if (!text && !mediaPath) return; // skip empty messages

      messages.push({
        id: 0,
        order_index: orderIndex++,
        sender,
        datetime,
        content: text,
        media_type: mediaType,
        media_path: mediaPath,
        is_favorite: 0,
        is_hidden: 0,
      });
    });
  }

  return { messages, participants };
}

function extractPageNumber(filename: string): number {
  const match = filename.match(/messages(\d*)\.html/);
  if (!match) return 999;
  return match[1] ? parseInt(match[1]) : 1;
}

function parseTelegramDate(title: string): string {
  // Format: "13.11.2022 00:47:19 UTC+03:00"
  const match = title.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2})/);
  if (!match) return new Date().toISOString();
  const [, day, month, year, time] = match;
  return `${year}-${month}-${day}T${time}`;
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add Telegram HTML chat parser"
```

---

## Task 5: Import Service

**Files:**
- Create: `src/lib/import.ts`

**Step 1: Create import service**

Create `src/lib/import.ts`:

This service handles:
1. Extracting ZIP/RAR archives
2. Detecting chat type (WhatsApp vs Telegram)
3. Parsing messages
4. Copying media files to organized directories
5. Writing to SQLite
6. Cleaning up extracted files

```typescript
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import JSZip from "jszip";
import { createExtractorFromData } from "node-unrar-js";
import { getMainDb, getChatDb } from "./db";
import { parseWhatsAppChat } from "./parsers/whatsapp";
import { parseTelegramChat } from "./parsers/telegram";
import { Message } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

interface ImportResult {
  chatId: string;
  name: string;
  messageCount: number;
}

export async function importChat(
  archiveBuffer: Buffer,
  archiveFileName: string,
  name: string,
  description: string
): Promise<ImportResult> {
  const chatId = uuidv4();
  const backupDir = path.join(DATA_DIR, "backups");
  const mediaDir = path.join(DATA_DIR, "media", chatId);
  const tempDir = path.join(DATA_DIR, "temp", chatId);

  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  // Save backup
  const backupPath = path.join(backupDir, `${chatId}_${archiveFileName}`);
  fs.writeFileSync(backupPath, archiveBuffer);

  try {
    // Extract archive
    await extractArchive(archiveBuffer, archiveFileName, tempDir);

    // Find the actual content directory (might be nested)
    const contentDir = findContentDir(tempDir);

    // Detect type and parse
    const isWhatsApp = detectWhatsApp(contentDir);
    let messages: Message[];
    let participants: Set<string>;

    if (isWhatsApp) {
      const txtFile = fs.readdirSync(contentDir).find((f) => f.endsWith(".txt"));
      if (!txtFile) throw new Error("WhatsApp text file not found");
      const text = fs.readFileSync(path.join(contentDir, txtFile), "utf-8");
      const result = parseWhatsAppChat(text);
      messages = result.messages;
      participants = result.participants;
    } else {
      const htmlFiles = fs
        .readdirSync(contentDir)
        .filter((f) => f.match(/^messages\d*\.html$/))
        .map((f) => ({
          name: f,
          content: fs.readFileSync(path.join(contentDir, f), "utf-8"),
        }));
      if (htmlFiles.length === 0) throw new Error("Telegram HTML files not found");
      const result = parseTelegramChat(htmlFiles);
      messages = result.messages;
      participants = result.participants;
    }

    // Process media files and copy to organized dirs
    processMediaFiles(messages, contentDir, mediaDir);

    // Write messages to chat DB
    const chatDb = getChatDb(chatId);
    const insert = chatDb.prepare(`
      INSERT INTO messages (order_index, sender, datetime, content, media_type, media_path, is_favorite, is_hidden)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0)
    `);

    const batchInsert = chatDb.transaction((msgs: Message[]) => {
      for (const msg of msgs) {
        insert.run(msg.order_index, msg.sender, msg.datetime, msg.content, msg.media_type, msg.media_path);
      }
    });
    batchInsert(messages);
    chatDb.close();

    // Register chat in main DB
    const mainDb = getMainDb();
    mainDb
      .prepare(
        `INSERT INTO chats (id, name, description, source_type, participants, message_count, created_at, backup_path, media_dir)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        chatId,
        name,
        description,
        isWhatsApp ? "whatsapp" : "telegram",
        JSON.stringify([...participants]),
        messages.length,
        new Date().toISOString(),
        backupPath,
        mediaDir
      );
    mainDb.close();

    return { chatId, name, messageCount: messages.length };
  } finally {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function extractArchive(buffer: Buffer, filename: string, destDir: string) {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(buffer);
    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (file.dir) {
        fs.mkdirSync(path.join(destDir, relativePath), { recursive: true });
        continue;
      }
      const destPath = path.join(destDir, relativePath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const content = await file.async("nodebuffer");
      fs.writeFileSync(destPath, content);
    }
  } else if (lower.endsWith(".rar")) {
    const data = Uint8Array.from(buffer).buffer;
    const extractor = await createExtractorFromData({ data });
    const extracted = extractor.extract();
    for (const file of extracted.files) {
      if (file.fileHeader.flags.directory) {
        fs.mkdirSync(path.join(destDir, file.fileHeader.name), { recursive: true });
        continue;
      }
      const destPath = path.join(destDir, file.fileHeader.name);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      if (file.extraction) {
        fs.writeFileSync(destPath, Buffer.from(file.extraction));
      }
    }
  } else {
    throw new Error(`Unsupported archive format: ${filename}`);
  }
}

function findContentDir(dir: string): string {
  const entries = fs.readdirSync(dir);
  // If there's only one subdirectory and no chat files, go deeper
  if (entries.length === 1) {
    const single = path.join(dir, entries[0]);
    if (fs.statSync(single).isDirectory()) {
      return findContentDir(single);
    }
  }
  return dir;
}

function detectWhatsApp(dir: string): boolean {
  const files = fs.readdirSync(dir);
  return files.some((f) => f.endsWith(".txt") && !f.endsWith(".html"));
}

const MEDIA_TYPE_DIRS: Record<string, string> = {
  image: "images",
  video: "video",
  audio: "audio",
  voice: "voice",
  sticker: "stickers",
  gif: "gif",
  document: "documents",
};

function processMediaFiles(messages: Message[], sourceDir: string, mediaDir: string) {
  // Create media subdirs
  for (const subdir of Object.values(MEDIA_TYPE_DIRS)) {
    fs.mkdirSync(path.join(mediaDir, subdir), { recursive: true });
  }

  for (const msg of messages) {
    if (!msg.media_path || msg.media_type === "text") continue;

    const originalPath = msg.media_path;
    // Try to find file in source directory (could be in subfolders)
    const sourcePath = findFile(sourceDir, originalPath);

    if (sourcePath && fs.existsSync(sourcePath)) {
      const typeDir = MEDIA_TYPE_DIRS[msg.media_type] || "documents";
      const filename = path.basename(originalPath);
      const destPath = path.join(mediaDir, typeDir, filename);

      fs.copyFileSync(sourcePath, destPath);
      msg.media_path = `${typeDir}/${filename}`;
    } else {
      // File not found, keep reference but mark appropriately
      msg.media_path = null;
      if (!msg.content) {
        msg.content = `[Файл не найден: ${originalPath}]`;
      }
    }
  }
}

function findFile(dir: string, relativePath: string): string | null {
  // Direct path
  const direct = path.join(dir, relativePath);
  if (fs.existsSync(direct)) return direct;

  // Just filename in root
  const filename = path.basename(relativePath);
  const inRoot = path.join(dir, filename);
  if (fs.existsSync(inRoot)) return inRoot;

  // Search in subdirectories
  const subdirs = fs.readdirSync(dir).filter((f) => {
    try {
      return fs.statSync(path.join(dir, f)).isDirectory();
    } catch {
      return false;
    }
  });

  for (const subdir of subdirs) {
    const inSub = path.join(dir, subdir, filename);
    if (fs.existsSync(inSub)) return inSub;
  }

  return null;
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add chat import service with ZIP/RAR extraction"
```

---

## Task 6: API Routes — Chats

**Files:**
- Create: `src/app/api/chats/route.ts`
- Create: `src/app/api/chats/import/route.ts`
- Create: `src/app/api/chats/[id]/route.ts`
- Create: `src/app/api/chats/[id]/messages/route.ts`
- Create: `src/app/api/chats/[id]/messages/[msgId]/route.ts`
- Create: `src/app/api/media/[chatId]/[...path]/route.ts`

**Step 1: Create GET /api/chats**

`src/app/api/chats/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getMainDb } from "@/lib/db";

export async function GET() {
  const db = getMainDb();
  const chats = db.prepare("SELECT * FROM chats ORDER BY created_at DESC").all();
  db.close();
  return NextResponse.json(
    chats.map((c: any) => ({ ...c, participants: JSON.parse(c.participants) }))
  );
}
```

**Step 2: Create POST /api/chats/import**

`src/app/api/chats/import/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { importChat } from "@/lib/import";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("archive") as File | null;
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || "";

  if (!file || !name) {
    return NextResponse.json({ error: "Archive file and name are required" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importChat(buffer, file.name, name, description);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 3: Create DELETE /api/chats/[id]**

`src/app/api/chats/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getMainDb, deleteChatDb } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getMainDb();
  const chat = db.prepare("SELECT * FROM chats WHERE id = ?").get(id) as any;
  db.close();
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  return NextResponse.json({ ...chat, participants: JSON.parse(chat.participants) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getMainDb();
  const chat = db.prepare("SELECT * FROM chats WHERE id = ?").get(id) as any;

  if (!chat) {
    db.close();
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Delete chat DB
  deleteChatDb(id);

  // Delete media directory
  const mediaDir = path.join(process.cwd(), "data", "media", id);
  if (fs.existsSync(mediaDir)) {
    fs.rmSync(mediaDir, { recursive: true, force: true });
  }

  // Remove from main DB (keep backup)
  db.prepare("DELETE FROM chats WHERE id = ?").run(id);
  db.close();

  return NextResponse.json({ success: true });
}
```

**Step 4: Create GET /api/chats/[id]/messages**

`src/app/api/chats/[id]/messages/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getChatDb } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const sender = url.searchParams.get("sender");
  const search = url.searchParams.get("search");
  const favorites = url.searchParams.get("favorites") === "true";

  const db = getChatDb(id);

  let where = "WHERE is_hidden = 0";
  const queryParams: any[] = [];

  if (sender) {
    where += " AND sender = ?";
    queryParams.push(sender);
  }
  if (search) {
    where += " AND content LIKE ?";
    queryParams.push(`%${search}%`);
  }
  if (favorites) {
    where += " AND is_favorite = 1";
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM messages ${where}`).get(...queryParams) as any;
  const messages = db
    .prepare(`SELECT * FROM messages ${where} ORDER BY order_index ASC LIMIT ? OFFSET ?`)
    .all(...queryParams, limit, offset);
  db.close();

  return NextResponse.json({
    messages,
    total: total.count,
    offset,
    limit,
  });
}
```

**Step 5: Create PATCH /api/chats/[id]/messages/[msgId]**

`src/app/api/chats/[id]/messages/[msgId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getChatDb } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const { id, msgId } = await params;
  const body = await request.json();
  const db = getChatDb(id);

  const updates: string[] = [];
  const values: any[] = [];

  if (body.is_favorite !== undefined) {
    updates.push("is_favorite = ?");
    values.push(body.is_favorite ? 1 : 0);
  }
  if (body.is_hidden !== undefined) {
    updates.push("is_hidden = ?");
    values.push(body.is_hidden ? 1 : 0);
  }

  if (updates.length === 0) {
    db.close();
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  values.push(parseInt(msgId));
  db.prepare(`UPDATE messages SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  const updated = db.prepare("SELECT * FROM messages WHERE id = ?").get(parseInt(msgId));
  db.close();

  return NextResponse.json(updated);
}
```

**Step 6: Create media serving route**

`src/app/api/media/[chatId]/[...path]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".3gp": "video/3gpp",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".wav": "audio/wav",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string; path: string[] }> }
) {
  const { chatId, path: pathParts } = await params;
  const filePath = path.join(process.cwd(), "data", "media", chatId, ...pathParts);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);

  // Support range requests for audio/video
  const range = request.headers.get("range");
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return new NextResponse(Buffer.concat(chunks), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": mimeType,
      },
    });
  }

  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
```

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add all API routes for chats, messages, and media"
```

---

## Task 7: Client State Store

**Files:**
- Create: `src/lib/store.ts`
- Create: `src/lib/api.ts`

**Step 1: Create API client**

`src/lib/api.ts`:
```typescript
import { Chat, Message } from "./types";

export async function fetchChats(): Promise<Chat[]> {
  const res = await fetch("/api/chats");
  return res.json();
}

export async function fetchChat(id: string): Promise<Chat> {
  const res = await fetch(`/api/chats/${id}`);
  return res.json();
}

export async function deleteChat(id: string): Promise<void> {
  await fetch(`/api/chats/${id}`, { method: "DELETE" });
}

export async function importChat(formData: FormData): Promise<{ chatId: string; name: string; messageCount: number }> {
  const res = await fetch("/api/chats/import", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Import failed");
  }
  return res.json();
}

export async function fetchMessages(
  chatId: string,
  params: { offset?: number; limit?: number; sender?: string; search?: string; favorites?: boolean }
): Promise<{ messages: Message[]; total: number; offset: number; limit: number }> {
  const url = new URL(`/api/chats/${chatId}/messages`, window.location.origin);
  if (params.offset) url.searchParams.set("offset", String(params.offset));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.sender) url.searchParams.set("sender", params.sender);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.favorites) url.searchParams.set("favorites", "true");
  const res = await fetch(url.toString());
  return res.json();
}

export async function toggleFavorite(chatId: string, msgId: number, isFavorite: boolean): Promise<Message> {
  const res = await fetch(`/api/chats/${chatId}/messages/${msgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_favorite: isFavorite }),
  });
  return res.json();
}

export async function toggleHidden(chatId: string, msgId: number, isHidden: boolean): Promise<Message> {
  const res = await fetch(`/api/chats/${chatId}/messages/${msgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_hidden: isHidden }),
  });
  return res.json();
}

export function mediaUrl(chatId: string, mediaPath: string): string {
  return `/api/media/${chatId}/${mediaPath}`;
}
```

**Step 2: Create Zustand store**

`src/lib/store.ts`:
```typescript
import { create } from "zustand";
import { Message } from "./types";

interface ChatViewState {
  // Filters
  senderFilter: string | null;
  searchQuery: string;
  favoritesOnly: boolean;

  // Media modal
  mediaModalOpen: boolean;
  mediaModalIndex: number;
  mediaMessages: Message[];

  // Actions
  setSenderFilter: (sender: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFavoritesOnly: (value: boolean) => void;
  openMediaModal: (messages: Message[], index: number) => void;
  closeMediaModal: () => void;
  nextMedia: () => void;
  prevMedia: () => void;
}

export const useChatViewStore = create<ChatViewState>((set, get) => ({
  senderFilter: null,
  searchQuery: "",
  favoritesOnly: false,
  mediaModalOpen: false,
  mediaModalIndex: 0,
  mediaMessages: [],

  setSenderFilter: (sender) => set({ senderFilter: sender }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFavoritesOnly: (value) => set({ favoritesOnly: value }),

  openMediaModal: (messages, index) =>
    set({ mediaModalOpen: true, mediaMessages: messages, mediaModalIndex: index }),
  closeMediaModal: () => set({ mediaModalOpen: false }),
  nextMedia: () => {
    const { mediaModalIndex, mediaMessages } = get();
    if (mediaModalIndex < mediaMessages.length - 1) {
      set({ mediaModalIndex: mediaModalIndex + 1 });
    }
  },
  prevMedia: () => {
    const { mediaModalIndex } = get();
    if (mediaModalIndex > 0) {
      set({ mediaModalIndex: mediaModalIndex - 1 });
    }
  },
}));
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add API client and Zustand store"
```

---

## Task 8: Chat List Page (Home)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/ChatCard.tsx`
- Create: `src/components/ImportDialog.tsx`

**Step 1: Build the home page**

The home page should show:
- App title "WTViewer"
- Grid of chat cards (name, description, source badge, message count, date)
- "Upload new chat" button opening a modal dialog
- Delete button on each card with confirmation

Style: dark theme with subtle gradients, card-based layout, clean typography.

Implement `src/app/globals.css` with Tailwind base plus custom CSS variables for the chat color scheme.

Implement `src/app/page.tsx` as client component ("use client") that fetches chats on mount and renders the grid.

Implement `src/components/ChatCard.tsx` — card component showing chat info with WhatsApp/Telegram badge, message count, delete button.

Implement `src/components/ImportDialog.tsx` — modal with file upload (accept .zip,.rar), name input, description textarea, progress indicator. On submit calls POST /api/chats/import with FormData.

**Step 2: Verify page renders**

Run: `npm run dev`
Navigate to localhost:3000, verify empty state with upload button shows.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add chat list home page with import dialog"
```

---

## Task 9: Chat View Page — Message List

**Files:**
- Create: `src/app/chat/[id]/page.tsx`
- Create: `src/components/MessageBubble.tsx`
- Create: `src/components/ChatHeader.tsx`
- Create: `src/components/FilterBar.tsx`

**Step 1: Build chat view page**

`src/app/chat/[id]/page.tsx` — client component that:
1. Fetches chat info on mount
2. Uses React Virtuoso for virtual scrolling of messages
3. Loads messages in batches of 200 via API
4. Implements infinite scrolling in both directions (prepend older, append newer)
5. Shows FilterBar at top and ChatHeader

`src/components/ChatHeader.tsx` — shows chat name, participant count, back button to home.

`src/components/FilterBar.tsx` — sender filter chips, search input with debounce, favorites toggle star button.

`src/components/MessageBubble.tsx` — the core message display:
- Bubble style inspired by Telegram (rounded corners, shadows, different colors per sender)
- Left/right alignment based on sender (first participant = left, second = right)
- Shows sender name, time, message text
- Favorite star toggle button
- Hide button (context menu or swipe)
- For media messages: thumbnail preview for images, play button for audio/voice, video thumbnail
- Soft green-tinted background pattern on the page (like Telegram Desktop)

Date separators between messages of different days (like "18 July" pill in the screenshot).

**Step 2: Verify chat view renders**

Import a test chat, navigate to it, verify messages display with scrolling.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add chat view page with virtual scrolling and message bubbles"
```

---

## Task 10: Media Components

**Files:**
- Create: `src/components/AudioPlayer.tsx`
- Create: `src/components/MediaModal.tsx`
- Create: `src/components/MediaThumbnail.tsx`

**Step 1: Build inline audio player**

`src/components/AudioPlayer.tsx`:
- Custom audio player with play/pause button, progress bar, duration
- Styled to fit inside message bubble
- Uses HTML5 Audio API
- Waveform-style visualization (simplified with CSS)

**Step 2: Build media modal**

`src/components/MediaModal.tsx`:
- Full-screen overlay (black backdrop)
- Shows image/video centered
- Left/right arrows for navigation between media messages
- Keyboard navigation (arrows, Escape to close)
- Click outside to close
- For video: HTML5 video player with controls
- Swipe support for mobile

**Step 3: Build media thumbnail**

`src/components/MediaThumbnail.tsx`:
- Renders appropriate preview based on media_type
- Images: lazy-loaded thumbnail
- Videos: thumbnail with play icon overlay
- Voice/Audio: shows AudioPlayer component
- Stickers: inline webp image
- GIF: inline gif/mp4 (autoplaying, looping, muted)

**Step 4: Wire media into MessageBubble**

Clicking image/video/gif in MessageBubble opens MediaModal.
Audio/voice plays inline via AudioPlayer.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add audio player, media modal, and media thumbnails"
```

---

## Task 11: Favorites and Navigation

**Files:**
- Modify: `src/app/chat/[id]/page.tsx`
- Modify: `src/components/MessageBubble.tsx`
- Modify: `src/components/FilterBar.tsx`

**Step 1: Implement favorites toggle**

Clicking star on MessageBubble calls PATCH API to toggle is_favorite, updates local state.

**Step 2: Implement favorites-only mode**

FilterBar toggle switches to favorites-only mode, refetches messages with favorites=true.

**Step 3: Implement click-to-navigate from favorites**

In favorites-only mode, clicking a message:
1. Remembers the message's order_index
2. Switches off favorites filter
3. Refetches full message list
4. Scrolls to that message using Virtuoso's scrollToIndex

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add favorites toggle and click-to-navigate from favorites view"
```

---

## Task 12: Test Import with Real Data

**Step 1: Start dev server and test WhatsApp import**

Run: `npm run dev`

Create a ZIP of the WhatsApp export:
```bash
cd /Users/miraxsage/Downloads && zip -r /tmp/nasty-wa.zip Nasty/
```

Upload via the UI, verify:
- Messages parse correctly
- Media files are copied
- Voice messages play
- Images display

**Step 2: Test Telegram import**

```bash
cd /Users/miraxsage/Downloads && zip -r /tmp/nasty-tg.zip NastyMoscow/
```

Upload via the UI, verify same.

**Step 3: Fix any parsing issues found during testing**

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: parser corrections from real data testing"
```

---

## Task 13: Polish and Final Touches

**Step 1: Add loading states and error handling**

- Skeleton loaders for chat list and messages
- Error boundaries
- Toast notifications for import success/failure
- Proper empty states

**Step 2: Add message search highlighting**

When search filter is active, highlight matching text in message bubbles.

**Step 3: Responsive design**

Ensure mobile-friendly layout (single column, touch-friendly buttons).

**Step 4: Final commit**

```bash
git add -A && git commit -m "feat: add loading states, search highlighting, and responsive design"
```

---

## Execution Summary

| Task | Description | Est. Complexity |
|------|-------------|-----------------|
| 1 | Project Setup | Low |
| 2 | Database Layer | Low |
| 3 | WhatsApp Parser | Medium |
| 4 | Telegram Parser | Medium |
| 5 | Import Service | High |
| 6 | API Routes | Medium |
| 7 | Client State | Low |
| 8 | Chat List Page | Medium |
| 9 | Chat View + Messages | High |
| 10 | Media Components | High |
| 11 | Favorites + Navigation | Medium |
| 12 | Test with Real Data | Medium |
| 13 | Polish | Medium |
