import fs from "fs";
import path from "path";

type EditionStory = {
  title: string;
  subheadline?: string;
  byline?: string;
  author?: string;
  category: string;
  summary: string;
  originPage: string;
  jumpMerged?: string;
  jumpDetails?: string;
};

export type EditionRecord = {
  publication_id: string;
  publication_name: string;
  date: string;
  edition: string;
  page_count: number;
  pages: string[];
  front_page: EditionStory[];
  page_three: EditionStory[];
  back_page: EditionStory[];
  ocr_confidence?: number | null;
};

export type PublicationRecord = {
  id: string;
  name: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";
const editorpulseApiKey = process.env.EDITORPULSE_API_KEY || "";

function ensureConfig() {
  if (!supabaseUrl || !supabaseKey || !editorpulseApiKey) {
    throw new Error("Supabase backend env vars are missing");
  }
}

function buildHeaders(extra?: HeadersInit) {
  ensureConfig();
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "x-editorpulse-api-key": editorpulseApiKey,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: buildHeaders(init.headers),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function listPublicationsFromSupabase() {
  const publications = await supabaseRequest<PublicationRecord[]>(
    "/rest/v1/publications?select=id,name&order=name.asc"
  );
  const editions = await supabaseRequest<EditionRecord[]>(
    "/rest/v1/editions?select=publication_id,publication_name,date,edition,page_count,pages,front_page,page_three,back_page,ocr_confidence&order=publication_name.asc,date.desc"
  );

  return { publications, editions };
}

export async function getEditionFromSupabase(publicationId: string, date: string) {
  const edition = await supabaseRequest<EditionRecord[]>(
    `/rest/v1/editions?select=publication_id,publication_name,date,edition,page_count,pages,front_page,page_three,back_page,ocr_confidence&publication_id=eq.${encodeURIComponent(publicationId)}&date=eq.${encodeURIComponent(date)}&limit=1`
  );
  return edition[0] || null;
}

export async function upsertPublication(publicationId: string, publicationName: string) {
  await supabaseRequest(
    "/rest/v1/publications?on_conflict=id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{ id: publicationId, name: publicationName }]),
    }
  );
}

export async function upsertEdition(record: EditionRecord) {
  await supabaseRequest(
    "/rest/v1/editions?on_conflict=publication_id,date",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([record]),
    }
  );
}

export async function deleteEditionFromSupabase(publicationId: string, date: string) {
  await supabaseRequest(
    `/rest/v1/editions?publication_id=eq.${encodeURIComponent(publicationId)}&date=eq.${encodeURIComponent(date)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    }
  );
}

export async function deletePublicationFromSupabase(publicationId: string) {
  await supabaseRequest(
    `/rest/v1/publications?id=eq.${encodeURIComponent(publicationId)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    }
  );
}

export async function syncLocalEditionToSupabase(options: {
  publicationId: string;
  publicationName: string;
  date: string;
  edition: string;
  pages: string[];
  editionDir: string;
}) {
  const summaryPath = path.join(options.editionDir, "summary.json");
  let summary: {
    frontPage?: EditionStory[];
    pageThree?: EditionStory[];
    backPage?: EditionStory[];
    ocrConfidence?: number;
  } = {};

  if (fs.existsSync(summaryPath)) {
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    } catch {
      summary = {};
    }
  }

  await upsertPublication(options.publicationId, options.publicationName);
  await upsertEdition({
    publication_id: options.publicationId,
    publication_name: options.publicationName,
    date: options.date,
    edition: options.edition,
    page_count: options.pages.length,
    pages: options.pages,
    front_page: summary.frontPage || [],
    page_three: summary.pageThree || [],
    back_page: summary.backPage || [],
    ocr_confidence: summary.ocrConfidence ?? null,
  });
}
