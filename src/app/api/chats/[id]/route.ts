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

  deleteChatDb(id);

  const mediaDir = path.join(process.cwd(), "data", "media", id);
  if (fs.existsSync(mediaDir)) {
    fs.rmSync(mediaDir, { recursive: true, force: true });
  }

  db.prepare("DELETE FROM chats WHERE id = ?").run(id);
  db.close();

  return NextResponse.json({ success: true });
}
