import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { uploadPageToSupabaseStorage } from "@/lib/editorpulse-backend";

export const maxDuration = 60;

function sanitizePathSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extensionForFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^(png|jpe?g|webp)$/.test(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminRequestAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const publicationId = sanitizePathSegment(String(formData.get("publicationId") || ""));
    const date = String(formData.get("date") || "");
    const pageIndex = Number(formData.get("pageIndex"));

    if (!(file instanceof File) || !publicationId || !date || !Number.isFinite(pageIndex)) {
      return NextResponse.json({ error: "file, publicationId, date, and pageIndex are required" }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extensionForFile(file);
    const objectPath = `${publicationId}/${date}/page-${String(pageIndex + 1).padStart(2, "0")}.${ext}`;
    const pageUrl = await uploadPageToSupabaseStorage({
      objectPath,
      buffer,
      contentType: file.type || (ext === "jpg" ? "image/jpeg" : `image/${ext}`),
    });

    return NextResponse.json({
      success: true,
      pageUrl,
      objectPath,
      pageIndex,
    });
  } catch (error: any) {
    console.error("Page upload error:", error);
    return NextResponse.json({ error: error.message || "Page upload failed" }, { status: 500 });
  }
}
