import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { listPublicationsFromSupabase } from "@/lib/editorpulse-backend";
import { getUploadsDir, localUploadUrl } from "@/lib/local-uploads";

const UPLOADS_DIR = getUploadsDir();
export const dynamic = "force-dynamic";

export interface EditionInfo {
  publicationId: string;
  publicationName: string;
  date: string;
  edition: string;
  pageCount: number;
  pages: string[];
}

export interface PublicationInfo {
  id: string;
  name: string;
  editions: EditionInfo[];
}

function readManifest(pubDir: string): any | null {
  const manifestPath = path.join(pubDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

function listLocalPublications(): PublicationInfo[] {
  if (!fs.existsSync(UPLOADS_DIR)) {
    return [];
  }

  const pubDirs = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const publications: PublicationInfo[] = [];

  for (const pubDir of pubDirs) {
    const pubPath = path.join(UPLOADS_DIR, pubDir.name);
    const manifest = readManifest(pubPath);

    if (manifest && manifest.editions) {
      publications.push({
        id: pubDir.name,
        name: manifest.publicationName || pubDir.name,
        editions: manifest.editions.map((ed: any) => ({
          publicationId: pubDir.name,
          publicationName: manifest.publicationName || pubDir.name,
          date: ed.date,
          edition: ed.edition || "Standard Edition",
          pageCount: ed.pageCount || 0,
          pages: ed.pages || [],
        })),
      });
      continue;
    }

    const dateDirs = fs.readdirSync(pubPath, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    const editions: EditionInfo[] = [];
    for (const dateDir of dateDirs) {
      const datePath = path.join(pubPath, dateDir.name);
      const imageFiles = fs.readdirSync(datePath)
        .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || "0");
          const numB = parseInt(b.match(/\d+/)?.[0] || "0");
          return numA - numB;
        });

      if (imageFiles.length > 0) {
        editions.push({
          publicationId: pubDir.name,
          publicationName: pubDir.name,
          date: dateDir.name,
          edition: "Standard Edition",
          pageCount: imageFiles.length,
          pages: imageFiles.map((f) => localUploadUrl(`${pubDir.name}/${dateDir.name}/${f}`)),
        });
      }
    }

    if (editions.length > 0) {
      publications.push({
        id: pubDir.name,
        name: pubDir.name,
        editions,
      });
    }
  }

  return publications;
}

export async function GET() {
  try {
    const { publications, editions } = await listPublicationsFromSupabase();

    if (publications.length > 0 || editions.length > 0) {
      const publicationMap = new Map(publications.map((pub) => [pub.id, pub.name]));
      const grouped = new Map<string, EditionInfo[]>();

      for (const edition of editions) {
        const pubId = edition.publication_id;
        const editionList = grouped.get(pubId) || [];
        editionList.push({
          publicationId: pubId,
          publicationName: edition.publication_name || publicationMap.get(pubId) || pubId,
          date: edition.date,
          edition: edition.edition || "Standard Edition",
          pageCount: edition.page_count || 0,
          pages: [],
        });
        grouped.set(pubId, editionList);
      }

      const responsePublications: PublicationInfo[] = publications.map((pub) => ({
        id: pub.id,
        name: pub.name,
        editions: (grouped.get(pub.id) || []).sort((a, b) => b.date.localeCompare(a.date)),
      }));

      for (const [pubId, editionList] of grouped.entries()) {
        if (!publicationMap.has(pubId)) {
          responsePublications.push({
            id: pubId,
            name: editionList[0]?.publicationName || pubId,
            editions: editionList.sort((a, b) => b.date.localeCompare(a.date)),
          });
        }
      }

      return NextResponse.json({ publications: responsePublications });
    }

    return NextResponse.json({ publications: listLocalPublications() });
  } catch (error: any) {
    console.error("Error listing editions:", error);
    return NextResponse.json({ publications: listLocalPublications(), error: error.message }, { status: 200 });
  }
}
