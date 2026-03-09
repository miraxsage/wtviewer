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
