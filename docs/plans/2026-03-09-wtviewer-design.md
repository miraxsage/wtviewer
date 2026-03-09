# WTViewer Design Document

## Overview
Web application for viewing exported WhatsApp and Telegram chat histories. Local single-user Next.js app with SQLite storage.

## Stack
- Next.js 15 (App Router)
- SQLite via better-sqlite3 (separate DB per chat)
- Tailwind CSS 4
- React Virtuoso (virtual scrolling)
- Zustand (client state)
- JSZip + node-unrar-js (archive extraction)
- Cheerio (Telegram HTML parsing)

## Data Model

### Main DB (`data/main.db`) — `chats` table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| name | TEXT | User-given name |
| description | TEXT | User-given description |
| source_type | TEXT | whatsapp or telegram |
| participants | TEXT (JSON) | Array of participant names |
| message_count | INTEGER | Total messages |
| created_at | TEXT | ISO timestamp |
| backup_path | TEXT | Path to original archive |
| media_dir | TEXT | Path to media folder |

### Chat DB (`data/chats/{chatId}.db`) — `messages` table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key autoincrement |
| order_index | INTEGER | Sequential order |
| sender | TEXT | Sender name |
| datetime | TEXT | ISO timestamp |
| content | TEXT | Message text |
| media_type | TEXT | text/image/video/audio/voice/sticker/gif/document |
| media_path | TEXT | Relative path to media file |
| is_favorite | INTEGER | 0 or 1 |
| is_hidden | INTEGER | 0 or 1 |

## File Structure
```
data/
  main.db
  chats/{chatId}.db
  media/{chatId}/images/
  media/{chatId}/video/
  media/{chatId}/audio/
  media/{chatId}/voice/
  media/{chatId}/stickers/
  media/{chatId}/gif/
  backups/{chatId}.zip|.rar
```

## Pages
1. `/` — Chat list with cards, upload/delete buttons
2. `/chat/[id]` — Chat viewer with filters, virtual scrolling, media modals

## API Routes
- `POST /api/chats/import` — Upload and import archive
- `GET /api/chats` — List chats
- `DELETE /api/chats/[id]` — Delete chat + all data
- `GET /api/chats/[id]/messages` — Paginated messages with filters
- `PATCH /api/chats/[id]/messages/[msgId]` — Toggle favorite/hidden
- `GET /api/media/[chatId]/[...path]` — Serve media files

## Import Process
1. Accept ZIP/RAR upload → save to `data/backups/`
2. Extract to temp dir
3. Detect type (WhatsApp: `.txt` file, Telegram: `messages.html`)
4. Parse messages → write to chat SQLite DB
5. Copy media files to `data/media/{chatId}/` organized by type
6. Replace file references in messages with internal paths
7. Clean up extracted temp folder
8. Chat appears in list

## WhatsApp Format
```
DD.MM.YYYY, HH:MM - Sender: message text
DD.MM.YYYY, HH:MM - Sender: ‎filename.ext (файл добавлен)
```

## Telegram Format
HTML files (`messages.html`, `messages2.html`, ...) with:
- `.message.default` divs containing sender, date, text
- Media: `.media_voice_message`, `.photo_wrap`, `.video_file_wrap`, `.sticker_wrap`, `.animated_wrap`
- Files in `photos/`, `voice_messages/`, `video_files/`, `stickers/`

## UI Style
Telegram Desktop-inspired: message bubbles on soft green patterned background, avatars, timestamps, inline media previews.
