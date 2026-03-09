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

  const conditions: string[] = ["is_hidden = 0"];
  const queryParams: any[] = [];

  if (sender) {
    conditions.push("sender = ?");
    queryParams.push(sender);
  }
  if (search) {
    conditions.push("content LIKE ?");
    queryParams.push(`%${search}%`);
  }
  if (favorites) {
    conditions.push("is_favorite = 1");
  }

  const where = "WHERE " + conditions.join(" AND ");

  const total = (db.prepare(`SELECT COUNT(*) as count FROM messages ${where}`).get(...queryParams) as any).count;
  const messages = db
    .prepare(`SELECT * FROM messages ${where} ORDER BY order_index ASC LIMIT ? OFFSET ?`)
    .all(...queryParams, limit, offset);
  db.close();

  return NextResponse.json({ messages, total, offset, limit });
}
