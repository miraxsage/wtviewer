import { NextRequest, NextResponse } from "next/server";
import { importChat, importChatFromFolder } from "@/lib/import";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    const { folderPath, name, description } = body;
    if (!folderPath || !name) {
      return NextResponse.json({ error: "Folder path and name are required" }, { status: 400 });
    }
    try {
      const result = importChatFromFolder(folderPath, name, description || "");
      return NextResponse.json(result);
    } catch (error) {
      console.error("Import error:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 500 });
    }
  }

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
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 500 });
  }
}
