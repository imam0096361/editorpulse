import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import {
  deleteEditionFromSupabase,
  deletePagesFromSupabaseStorage,
  deletePublicationFromSupabase,
  getEditionFromSupabase,
  listEditionDatesForPublication,
} from "@/lib/editorpulse-backend";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

function isSafePathSegment(value: string) {
  return value.length > 0 && !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..";
}

function getLocalEdition(pubId: string, date: string) {
  const pubPath = path.join(UPLOADS_DIR, pubId);
  const datePath = path.join(UPLOADS_DIR, pubId, date);
  const manifestPath = path.join(pubPath, "manifest.json");
  let manifest: any = null;
  let editionMeta: any = null;

  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      editionMeta = manifest.editions?.find((edition: any) => edition.date === date) || null;
    } catch {
      manifest = null;
      editionMeta = null;
    }
  }

  const imageFiles = fs.existsSync(datePath)
    ? fs.readdirSync(datePath)
        .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || "0");
          const numB = parseInt(b.match(/\d+/)?.[0] || "0");
          return numA - numB;
        })
    : [];

  const pages = imageFiles.length > 0
    ? imageFiles.map((f) => `/uploads/${pubId}/${date}/${f}`)
    : Array.isArray(editionMeta?.pages)
      ? editionMeta.pages
      : [];

  const summaryPath = path.join(datePath, "summary.json");
  let summaryData: any = {};
  if (fs.existsSync(summaryPath)) {
    try {
      summaryData = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    } catch {
      // ignore
    }
  }

  if (pages.length === 0 && !editionMeta && Object.keys(summaryData).length === 0) {
    return null;
  }

  return {
    publicationId: pubId,
    publicationName: manifest?.publicationName || summaryData.publicationName || pubId,
    date,
    edition: editionMeta?.edition || summaryData.edition || "Standard Edition",
    pageCount: editionMeta?.pageCount || pages.length,
    pages,
    frontPage: summaryData.frontPage || [],
    pageThree: summaryData.pageThree || [],
    backPage: summaryData.backPage || [],
    ocrConfidence: summaryData.ocrConfidence || (summaryData.frontPage ? 95 : undefined),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pubId: string; date: string }> }
) {
  try {
    const { pubId, date } = await params;

    if (!isSafePathSegment(pubId) || !isSafePathSegment(date)) {
      return NextResponse.json({ error: "Invalid edition path" }, { status: 400 });
    }

    const backendEdition = await getEditionFromSupabase(pubId, date);
    if (backendEdition) {
      return NextResponse.json({
        publicationId: backendEdition.publication_id,
        publicationName: backendEdition.publication_name,
        date: backendEdition.date,
        edition: backendEdition.edition,
        pageCount: backendEdition.page_count,
        pages: backendEdition.pages || [],
        frontPage: backendEdition.front_page || [],
        pageThree: backendEdition.page_three || [],
        backPage: backendEdition.back_page || [],
        ocrConfidence: backendEdition.ocr_confidence ?? undefined,
      });
    }

    const localEdition = getLocalEdition(pubId, date);
    if (localEdition) {
      return NextResponse.json(localEdition);
    }

    return NextResponse.json({ error: "Edition not found" }, { status: 404 });
  } catch (error: any) {
    console.error("Error getting edition:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pubId: string; date: string }> }
) {
  try {
    if (!(await isAdminRequestAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pubId, date } = await params;

    if (!isSafePathSegment(pubId) || !isSafePathSegment(date)) {
      return NextResponse.json({ error: "Invalid edition path" }, { status: 400 });
    }

    const backendEdition = await getEditionFromSupabase(pubId, date).catch(() => null);
    const pubPath = path.join(UPLOADS_DIR, pubId);
    const datePath = path.join(pubPath, date);

    if (fs.existsSync(datePath)) {
      fs.rmSync(datePath, { recursive: true, force: true });
    }

    const manifestPath = path.join(pubPath, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        manifest.editions = (manifest.editions || []).filter((edition: any) => edition.date !== date);

        if (manifest.editions.length > 0) {
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        } else {
          fs.rmSync(manifestPath, { force: true });
        }
      } catch {
        // ignore manifest cleanup failure
      }
    }

    if (fs.existsSync(pubPath)) {
      const remainingEditionDirs = fs.readdirSync(pubPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory());

      if (remainingEditionDirs.length === 0) {
        fs.rmSync(pubPath, { recursive: true, force: true });
      }
    }

    try {
      if (backendEdition?.pages?.length) {
        await deletePagesFromSupabaseStorage(backendEdition.pages);
      }

      await deleteEditionFromSupabase(pubId, date);

      const localRemaining = fs.existsSync(UPLOADS_DIR) && fs.existsSync(pubPath)
        ? fs.readdirSync(pubPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
        : 0;
      const backendRemaining = await listEditionDatesForPublication(pubId).catch(() => []);

      if (localRemaining === 0 && backendRemaining.length === 0) {
        await deletePublicationFromSupabase(pubId);
      }
    } catch (dbError) {
      console.error("Supabase delete failed, local files were still removed:", dbError);
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${pubId} edition for ${date}`,
    });
  } catch (error: any) {
    console.error("Error deleting edition:", error);
    return NextResponse.json({ error: error.message || "Failed to delete edition" }, { status: 500 });
  }
}
