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
  const mediaType = url.searchParams.get("media_type");
  const aroundOrderIndex = url.searchParams.get("around_order_index");

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
  if (mediaType) {
    conditions.push("media_type = ?");
    queryParams.push(mediaType);
  }

  const where = "WHERE " + conditions.join(" AND ");

  const total = (db.prepare(`SELECT COUNT(*) as count FROM messages ${where}`).get(...queryParams) as any).count;

  // Navigate around a specific order_index: find its position among filtered rows, then load a window around it
  if (aroundOrderIndex !== null && aroundOrderIndex !== undefined) {
    const targetIndex = parseInt(aroundOrderIndex);
    const half = Math.floor(limit / 2);

    // Count how many filtered rows come before this order_index
    const posBefore = (db.prepare(
      `SELECT COUNT(*) as count FROM messages ${where} AND order_index < ?`
    ).get(...queryParams, targetIndex) as any).count;

    const computedOffset = Math.max(0, posBefore - half);
    const messages = db
      .prepare(`SELECT * FROM messages ${where} ORDER BY order_index ASC LIMIT ? OFFSET ?`)
      .all(...queryParams, limit, computedOffset);
    db.close();

    return NextResponse.json({ messages, total, offset: computedOffset, limit });
  }

  const messages = db
    .prepare(`SELECT * FROM messages ${where} ORDER BY order_index ASC LIMIT ? OFFSET ?`)
    .all(...queryParams, limit, offset);
  db.close();

  return NextResponse.json({ messages, total, offset, limit });
}
