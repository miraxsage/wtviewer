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
