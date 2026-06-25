import path from "path";

export function getUploadsDir() {
  return process.env.EDITORPULSE_UPLOADS_DIR?.trim() || path.join(process.cwd(), "public", "uploads");
}

export function localUploadPath(...segments: string[]) {
  return path.join(getUploadsDir(), ...segments);
}

export function localUploadUrl(objectPath: string) {
  return `/uploads/${objectPath.replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

export function pathFromLocalUploadUrl(pageUrl: string) {
  if (!pageUrl.startsWith("/uploads/")) {
    return null;
  }

  const objectPath = pageUrl.replace(/^\/uploads\/+/, "");
  return localUploadPath(...objectPath.split("/"));
}
