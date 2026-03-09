import { NextRequest, NextResponse } from "next/server";
import { getMainDb, deleteChatDb } from "@/lib/db";
import fs from "fs";
import path from "path";

function serializeChat(row: any) {
  return {
    ...row,
    participants: JSON.parse(row.participants),
    participant_details: JSON.parse(row.participant_details || '{}'),
    show_own_sender: !!row.show_own_sender,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getMainDb();
  const chat = db.prepare("SELECT * FROM chats WHERE id = ?").get(id) as any;
  db.close();
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  return NextResponse.json(serializeChat(chat));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const db = getMainDb();

  const chat = db.prepare("SELECT * FROM chats WHERE id = ?").get(id) as any;
  if (!chat) {
    db.close();
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  if (body.participant_details !== undefined) {
    db.prepare("UPDATE chats SET participant_details = ? WHERE id = ?")
      .run(JSON.stringify(body.participant_details), id);
  }
  if (body.name !== undefined) {
    db.prepare("UPDATE chats SET name = ? WHERE id = ?")
      .run(body.name, id);
  }
  if (body.show_own_sender !== undefined) {
    db.prepare("UPDATE chats SET show_own_sender = ? WHERE id = ?")
      .run(body.show_own_sender ? 1 : 0, id);
  }

  const updated = db.prepare("SELECT * FROM chats WHERE id = ?").get(id) as any;
  db.close();

  return NextResponse.json(serializeChat(updated));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
