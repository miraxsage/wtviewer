# WTViewer

Desktop application for viewing exported WhatsApp and Telegram chat histories. Built with Next.js and Electron, stores data locally in SQLite.

## Features

- **Import** — ZIP/RAR archives or unpacked folders (WhatsApp `.txt` exports, Telegram HTML exports)
- **Media** — images, video, audio, voice messages, stickers, GIFs, documents with gallery view
- **Search & Filter** — full-text search, filter by sender, favorites-only mode
- **Keyboard navigation** — W/S to move between messages, Space to play audio or open media, A/D to seek or browse gallery (layout-independent, works with EN/RU keyboards)
- **Virtual scrolling** — handles large chats efficiently via react-virtuoso
- **Chat settings** — rename participants, reorder left/right display, toggle sender labels
- **Portable** — settings and data folder auto-discovered next to the executable

## Tech Stack

- **Frontend** — Next.js 16 (App Router), React 19, Tailwind CSS 4, Zustand
- **Backend** — Next.js API routes, SQLite (better-sqlite3), separate DB per chat
- **Desktop** — Electron 40, standalone Next.js server bundled via electron-builder
- **Parsing** — Cheerio (Telegram HTML), regex-based (WhatsApp txt), JSZip, node-unrar-js

## Development

```bash
npm install
npm run dev        # Next.js dev server + Electron
```

## Building

```bash
npm run dist:mac     # macOS (DMG)
npm run dist:win     # Windows (NSIS installer)
npm run dist:linux   # Linux
```

Native modules (better-sqlite3) are automatically rebuilt for the target platform via `electron-rebuild`.

## Data Structure

```
data/
  main.db                    # chat index
  chats/{chatId}.db          # messages per chat
  media/{chatId}/images/     # extracted media files
  media/{chatId}/video/
  media/{chatId}/audio/
  media/{chatId}/voice/
  media/{chatId}/stickers/
  backups/{chatId}_file.zip  # original archives
```
