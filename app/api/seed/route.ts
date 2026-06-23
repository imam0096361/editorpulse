import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { runGeminiOCR } from "../upload/route";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { syncLocalEditionToSupabase } from "@/lib/editorpulse-backend";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const PROTHOM_ALO_SAMPLES = path.join(process.cwd(), "Prothom Alo");
const SAMAKAL_SAMPLES = path.join(process.cwd(), "SomoKal");

function updateManifest(
  pubId: string,
  publicationName: string,
  editionData: {
    date: string;
    edition: string;
    pageCount: number;
    pages: string[];
  }
) {
  const pubDir = path.join(UPLOADS_DIR, pubId);
  const manifestPath = path.join(pubDir, "manifest.json");

  let manifest: any = {
    publicationId: pubId,
    publicationName,
    editions: [],
  };

  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch { /* start fresh */ }
  }

  manifest.editions = (manifest.editions || []).filter(
    (e: any) => e.date !== editionData.date
  );
  manifest.editions.unshift(editionData);
  manifest.publicationName = publicationName;

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminRequestAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let pubId = "prothom-alo";
    let ocrPagesInput = "1, 2, 17";

    try {
      const body = await req.json();
      if (body.pubId) pubId = body.pubId;
      if (body.ocrPages) ocrPagesInput = body.ocrPages;
    } catch {
      // Fallback if no json body is provided
    }

    const isSamakal = pubId === "samakal";
    if (isSamakal && ocrPagesInput === "1, 2, 17") {
      ocrPagesInput = "1, 2, 3, last";
    }
    const publicationName = isSamakal ? "সমকাল (Samakal)" : "প্রথম আলো (Prothom Alo)";
    const sampleDir = isSamakal ? SAMAKAL_SAMPLES : PROTHOM_ALO_SAMPLES;
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const editionDir = path.join(UPLOADS_DIR, pubId, today);

    // Check if already seeded
    if (fs.existsSync(editionDir)) {
      const existingFiles = fs.readdirSync(editionDir)
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
      if (existingFiles.length > 0) {
        return NextResponse.json({
          success: true,
          message: `${publicationName} already seeded`,
          alreadyExists: true,
          pageCount: existingFiles.length,
        });
      }
    }

    // Check if sample directory exists
    if (!fs.existsSync(sampleDir)) {
      return NextResponse.json(
        { error: `${publicationName} sample directory not found at ${sampleDir}` },
        { status: 404 }
      );
    }

    // Read and sort sample files
    const sampleFiles = fs.readdirSync(sampleDir)
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });

    if (sampleFiles.length === 0) {
      return NextResponse.json(
        { error: `No sample images found in ${publicationName} directory` },
        { status: 404 }
      );
    }

    // Create directory and copy files
    fs.mkdirSync(editionDir, { recursive: true });

    const savedPages: string[] = [];
    // Filter out duplicate (Page 6.1.png) for Prothom Alo
    const primaryFiles = isSamakal 
      ? sampleFiles 
      : sampleFiles.filter(f => !f.includes("6.1"));

    for (let i = 0; i < primaryFiles.length; i++) {
      const srcFile = primaryFiles[i];
      const ext = srcFile.split(".").pop() || "png";
      const destName = `page-${(i + 1).toString().padStart(2, "0")}.${ext}`;
      const srcPath = path.join(sampleDir, srcFile);
      const destPath = path.join(editionDir, destName);

      fs.copyFileSync(srcPath, destPath);
      savedPages.push(`/uploads/${pubId}/${today}/${destName}`);
    }

    const editionLabel = isSamakal ? "ঢাকা সংস্করণ (Dhaka Edition)" : "ঢাকা সংস্করণ (Dhaka Edition)";

    // Update manifest
    updateManifest(pubId, publicationName, {
      date: today,
      edition: editionLabel,
      pageCount: savedPages.length,
      pages: savedPages,
    });

    // Run Gemini OCR news summary generation
    await runGeminiOCR(pubId, publicationName, today, editionLabel, savedPages, editionDir, ocrPagesInput);
    try {
      await syncLocalEditionToSupabase({
        publicationId: pubId,
        publicationName,
        date: today,
        edition: editionLabel,
        pages: savedPages,
        editionDir,
      });
    } catch (syncError) {
      console.error("Supabase sync failed after seed:", syncError);
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${savedPages.length} pages for ${publicationName}`,
      alreadyExists: false,
      pageCount: savedPages.length,
      date: today,
      pages: savedPages,
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: error.message || "Seed failed" },
      { status: 500 }
    );
  }
}
