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

export type EditionListRecord = Pick<
  EditionRecord,
  "publication_id" | "publication_name" | "date" | "edition" | "page_count"
>;

const localUploadsDir = path.join(process.cwd(), "public", "uploads");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";
const editorpulseApiKey = process.env.EDITORPULSE_API_KEY || "";
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "editorpulse-pages";

export function hasSupabaseBackendConfig() {
  return Boolean(supabaseUrl && supabaseKey && editorpulseApiKey);
}

function ensureConfig() {
  if (!hasSupabaseBackendConfig()) {
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

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

function encodeObjectPath(objectPath: string) {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

function objectPathFromPublicUrl(pageUrl: string) {
  if (!supabaseUrl || !pageUrl.startsWith(supabaseUrl)) {
    return null;
  }

  const marker = `/storage/v1/object/public/${storageBucket}/`;
  const markerIndex = pageUrl.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  return decodeURIComponent(pageUrl.slice(markerIndex + marker.length));
}

export function getSupabaseStoragePublicUrl(objectPath: string) {
  ensureConfig();
  return `${supabaseUrl}/storage/v1/object/public/${storageBucket}/${encodeObjectPath(objectPath)}`;
}

export function savePageToLocalUploads(options: {
  objectPath: string;
  buffer: Buffer;
}) {
  const destinationPath = path.join(localUploadsDir, options.objectPath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(destinationPath, options.buffer);
  return `/uploads/${options.objectPath.replace(/\\/g, "/")}`;
}

export async function uploadPageToSupabaseStorage(options: {
  objectPath: string;
  buffer: Buffer;
  contentType: string;
}) {
  ensureConfig();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${storageBucket}/${encodeObjectPath(options.objectPath)}`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "x-editorpulse-api-key": editorpulseApiKey,
        "Content-Type": options.contentType,
        "x-upsert": "true",
      },
      body: options.buffer as unknown as BodyInit,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase storage upload failed (${response.status}): ${text}`);
  }

  return getSupabaseStoragePublicUrl(options.objectPath);
}

export async function deletePagesFromSupabaseStorage(pageUrls: string[]) {
  if (!hasSupabaseBackendConfig()) {
    return;
  }

  const objectPaths = pageUrls
    .map(objectPathFromPublicUrl)
    .filter((objectPath): objectPath is string => Boolean(objectPath));

  if (objectPaths.length === 0) {
    return;
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${storageBucket}`, {
    method: "DELETE",
    headers: buildHeaders(),
    body: JSON.stringify({ prefixes: objectPaths }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase storage delete failed (${response.status}): ${text}`);
  }
}

export async function listPublicationsFromSupabase() {
  if (!hasSupabaseBackendConfig()) {
    return { publications: [], editions: [] };
  }

  const [publications, editions] = await Promise.all([
    supabaseRequest<PublicationRecord[]>("/rest/v1/publications?select=id,name&order=name.asc"),
    supabaseRequest<EditionListRecord[]>(
      "/rest/v1/editions?select=publication_id,publication_name,date,edition,page_count&order=publication_name.asc,date.desc"
    ),
  ]);

  return { publications, editions };
}

export async function getEditionFromSupabase(publicationId: string, date: string) {
  if (!hasSupabaseBackendConfig()) {
    return null;
  }

  const edition = await supabaseRequest<EditionRecord[]>(
    `/rest/v1/editions?select=publication_id,publication_name,date,edition,page_count,pages,front_page,page_three,back_page,ocr_confidence&publication_id=eq.${encodeURIComponent(publicationId)}&date=eq.${encodeURIComponent(date)}&limit=1`
  );
  return edition[0] || null;
}

export async function listEditionDatesForPublication(publicationId: string) {
  if (!hasSupabaseBackendConfig()) {
    return [];
  }

  return supabaseRequest<{ date: string }[]>(
    `/rest/v1/editions?select=date&publication_id=eq.${encodeURIComponent(publicationId)}`
  );
}

export async function upsertPublication(publicationId: string, publicationName: string) {
  if (!hasSupabaseBackendConfig()) {
    return;
  }

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
  if (!hasSupabaseBackendConfig()) {
    return;
  }

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
  if (!hasSupabaseBackendConfig()) {
    return;
  }

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
  if (!hasSupabaseBackendConfig()) {
    return;
  }

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
  if (!hasSupabaseBackendConfig()) {
    return;
  }

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
