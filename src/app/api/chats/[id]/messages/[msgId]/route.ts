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
