import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getUploadsDir } from "@/lib/local-uploads";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function isSafeSegment(segment: string) {
  return segment.length > 0 && segment !== "." && segment !== ".." && !segment.includes("/") && !segment.includes("\\");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: fileSegments } = await params;

  if (!Array.isArray(fileSegments) || fileSegments.some((segment) => !isSafeSegment(segment))) {
    return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
  }

  const uploadsDir = getUploadsDir();
  const filePath = path.join(uploadsDir, ...fileSegments);
  const relativePath = path.relative(uploadsDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const body = fs.readFileSync(filePath);

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
    },
  });
}
