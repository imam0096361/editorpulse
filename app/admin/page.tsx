"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  Newspaper,
  Check,
  X,
  Trash2,
  ArrowLeft,
  FolderOpen,
  Image as ImageIcon,
  Calendar,
  Tag,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { EditorPulseLogo } from "@/components/editor-pulse-logo";

interface EditionInfo {
  publicationId: string;
  publicationName: string;
  date: string;
  edition: string;
  pageCount: number;
  pages: string[];
}

interface PublicationInfo {
  id: string;
  name: string;
  editions: EditionInfo[];
}

const PUBLICATION_PRESETS = [
  { id: "prothom-alo", name: "প্রথম আলো (Prothom Alo)" },
  { id: "samakal", name: "সমকাল (Samakal)" },
  { id: "daily-star", name: "The Daily Star" },
  { id: "kaler-kantho", name: "কালের কণ্ঠ (Kaler Kantho)" },
  { id: "jugantor", name: "যুগান্তর (Jugantor)" },
  { id: "ittefaq", name: "দৈনিক ইত্তেফাক (The Daily Ittefaq)" },
  { id: "custom", name: "— Custom Publication —" },
];

function getLocalDateInputValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().split("T")[0];
}

async function readJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const message = text.includes("Request Entity Too Large")
      ? "Upload image is too large for Vercel. Try a smaller scan or PDF export."
      : text || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
}

async function compressImageForUpload(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/webp") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = 1800;
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.78);
  });

  if (!blob || blob.size >= file.size) {
    return file;
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export default function AdminPage() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // Upload form state
  const [selectedPreset, setSelectedPreset] = useState(PUBLICATION_PRESETS[0].id);
  const [customName, setCustomName] = useState("");
  const [pubDate, setPubDate] = useState(getLocalDateInputValue);
  const [editionLabel, setEditionLabel] = useState("Standard Edition");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  // Existing editions
  const [publications, setPublications] = useState<PublicationInfo[]>([]);
  const [isLoadingEditions, setIsLoadingEditions] = useState(true);

  // Seed state
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSeedingSamakal, setIsSeedingSamakal] = useState(false);
  const [ocrPagesInput, setOcrPagesInput] = useState("1, 2, 17");
  const [deletingEditionKey, setDeletingEditionKey] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPreset === "prothom-alo") {
      setOcrPagesInput("1, 2, 17");
    } else if (selectedPreset === "daily-star") {
      setOcrPagesInput("1, 3, 12");
    } else if (selectedPreset === "samakal") {
      setOcrPagesInput("1, 2, 3, last");
    } else {
      setOcrPagesInput("1, 3, last");
    }
  }, [selectedPreset]);

  const fetchEditions = useCallback(async () => {
    setIsLoadingEditions(true);
    try {
      const res = await fetch("/api/editions", { cache: "no-store" });
      const data = await readJsonResponse(res);
      setPublications(data.publications || []);
    } catch (error) {
      console.error("Failed to fetch editions:", error);
    } finally {
      setIsLoadingEditions(false);
    }
  }, []);

  useEffect(() => { fetchEditions(); }, [fetchEditions]);

  const getPublicationName = () => {
    if (selectedPreset === "custom") return customName;
    return PUBLICATION_PRESETS.find(p => p.id === selectedPreset)?.name || "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  // PDF Extraction state
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");

  const processPdfFile = async (pdfFile: File) => {
    setPdfExtracting(true);
    setPdfProgress("Initializing PDF renderer...");
    try {
      // 1. Load pdf.js dynamically
      await new Promise<void>((resolve, reject) => {
        if ((window as any).pdfjsLib) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve();
        };
        script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
        document.head.appendChild(script);
      });

      const pdfjsLib = (window as any).pdfjsLib;
      
      // 2. Read file to array buffer
      const arrayBuffer = await pdfFile.arrayBuffer();
      
      // 3. Load PDF
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const totalPages = pdf.numPages;
      const extractedFiles: File[] = [];

      // Extract up to 20 pages
      const pagesToProcess = Math.min(totalPages, 20);
      
      for (let i = 1; i <= pagesToProcess; i++) {
        setPdfProgress(`Rendering page ${i} of ${pagesToProcess}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Scale up for OCR clarity

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        
        if (!context) {
          throw new Error("Could not construct 2D canvas context");
        }

        await page.render({ canvasContext: context, viewport }).promise;

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob) {
          const file = new File([blob], `page-${i.toString().padStart(2, "0")}.png`, { type: "image/png" });
          extractedFiles.push(file);
        }
      }

      setAttachedFiles(prev => {
        const combined = [...prev, ...extractedFiles];
        return combined.slice(0, 20);
      });
      setUploadResult({
        success: true,
        message: `Extracted ${pagesToProcess} pages from PDF successfully!`,
      });
    } catch (err: any) {
      console.error(err);
      setUploadResult({
        success: false,
        message: `Failed to render PDF: ${err.message || err}`,
      });
    } finally {
      setPdfExtracting(false);
      setPdfProgress("");
    }
  };

  const handleFiles = async (files: File[]) => {
    const images = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f.name));
    const pdfs = files.filter(f => /\.pdf$/i.test(f.name));

    if (images.length > 0) {
      setAttachedFiles(prev => [...prev, ...images].slice(0, 20));
    }

    if (pdfs.length > 0) {
      await processPdfFile(pdfs[0]);
    }
  };

  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (attachedFiles.length === 0 || !pubDate.trim()) return;
    const pubName = getPublicationName();
    if (!pubName.trim()) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const publicationId = selectedPreset === "custom"
        ? pubName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "")
        : selectedPreset;

      // Sort files by name (to maintain page order)
      const sortedFiles = [...attachedFiles].sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.name.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });

      const uploadedPages: string[] = [];
      for (let index = 0; index < sortedFiles.length; index++) {
        const file = await compressImageForUpload(sortedFiles[index]);
        const pageFormData = new FormData();
        pageFormData.append("file", file);
        pageFormData.append("publicationId", publicationId);
        pageFormData.append("date", pubDate);
        pageFormData.append("pageIndex", String(index));

        const pageRes = await fetch("/api/upload-page", { method: "POST", body: pageFormData });
        const pageData = await readJsonResponse(pageRes);

        if (!pageRes.ok || !pageData.success) {
          throw new Error(pageData.error || `Failed uploading page ${index + 1}`);
        }

        uploadedPages[index] = pageData.pageUrl;
        setUploadProgress(Math.round(((index + 1) / sortedFiles.length) * 70));
      }

      const finalizeFormData = new FormData();
      finalizeFormData.append("publicationName", pubName);
      finalizeFormData.append("publicationId", publicationId);
      finalizeFormData.append("date", pubDate);
      finalizeFormData.append("edition", editionLabel);
      finalizeFormData.append("ocrPages", ocrPagesInput);
      finalizeFormData.append("pages", JSON.stringify(uploadedPages));

      setUploadProgress(82);
      const res = await fetch("/api/upload", { method: "POST", body: finalizeFormData });
      setUploadProgress(100);

      const data = await readJsonResponse(res);
      if (res.ok && data.success) {
        setUploadResult({
          success: true,
          message: `Successfully uploaded ${data.pageCount} pages for ${pubName} (${pubDate})`,
        });
        setAttachedFiles([]);
        fetchEditions();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setUploadResult({
        success: false,
        message: error.message || "Upload failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSeedProthomAlo = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pubId: "prothom-alo", ocrPages: "1, 2, 17" })
      });
      const data = await readJsonResponse(res);
      if (res.ok && data.success) {
        setUploadResult({
          success: true,
          message: data.alreadyExists
            ? "Prothom Alo sample data already exists!"
            : `Seeded ${data.pageCount} pages for Prothom Alo successfully!`,
        });
        fetchEditions();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setUploadResult({
        success: false,
        message: error.message || "Seed failed",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSeedSamakal = async () => {
    setIsSeedingSamakal(true);
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pubId: "samakal", ocrPages: "1, 2, 3, last" })
      });
      const data = await readJsonResponse(res);
      if (res.ok && data.success) {
        setUploadResult({
          success: true,
          message: data.alreadyExists
            ? "Samakal sample data already exists!"
            : `Seeded ${data.pageCount} pages for Samakal successfully!`,
        });
        fetchEditions();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setUploadResult({
        success: false,
        message: error.message || "Seed failed",
      });
    } finally {
      setIsSeedingSamakal(false);
    }
  };

  const handleDeleteEdition = async (edition: EditionInfo) => {
    const editionKey = `${edition.publicationId}-${edition.date}`;
    const confirmed = window.confirm(
      `Delete ${edition.publicationName} (${edition.date})?\n\nThis will remove the uploaded pages and generated summary for this edition.`
    );

    if (!confirmed) return;

    setDeletingEditionKey(editionKey);
    setUploadResult(null);

    try {
      const res = await fetch(
        `/api/editions/${encodeURIComponent(edition.publicationId)}/${encodeURIComponent(edition.date)}`,
        { method: "DELETE" }
      );
      const data = await readJsonResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Delete failed");
      }

      setUploadResult({
        success: true,
        message: `Deleted ${edition.publicationName} (${edition.date}) successfully.`,
      });
      await fetchEditions();
    } catch (error: any) {
      setUploadResult({
        success: false,
        message: error.message || "Delete failed",
      });
    } finally {
      setDeletingEditionKey(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      window.location.href = "/admin/login";
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center font-mono text-slate-400">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  const totalEditions = publications.reduce((sum, p) => sum + p.editions.length, 0);

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-200 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#0F172A]/95 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-wider">Editor View</span>
            </Link>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex items-center gap-3">
              <EditorPulseLogo className="h-10 w-10 rounded-xl shadow-lg shadow-cyan-950/40 ring-1 ring-white/10" />
              <div>
                <h1 className="font-extrabold text-lg text-white tracking-tight">
                  Editor<span className="text-emerald-400">Pulse</span>
                  <span className="text-slate-500 font-medium text-sm ml-2">Admin</span>
                </h1>
                <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
                  Publication Management Console
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-400">{publications.length} Publications</p>
              <p className="text-[10px] text-slate-500 font-mono">{totalEditions} Total Editions</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 bg-slate-800/60 hover:bg-slate-700 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              onClick={fetchEditions}
              className="p-2 bg-slate-800/60 hover:bg-slate-700 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingEditions ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Upload Panel — Left 3 columns */}
        <div className="lg:col-span-3 space-y-6">
          {/* Upload Result Banner */}
          <AnimatePresence>
            {uploadResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex items-center gap-3 p-4 rounded-xl border ${
                  uploadResult.success
                    ? "bg-emerald-950/50 border-emerald-800/50 text-emerald-300"
                    : "bg-red-950/50 border-red-800/50 text-red-300"
                }`}
              >
                {uploadResult.success
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  : <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                }
                <p className="text-sm font-medium flex-1">{uploadResult.message}</p>
                <button
                  onClick={() => setUploadResult(null)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload Card */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800/60 overflow-hidden">
            <div className="p-5 border-b border-slate-800/60 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600/20 p-2 rounded-lg">
                  <Upload className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-white">Upload Newspaper Edition</h2>
                  <p className="text-xs text-slate-500">Upload page scans (PNG/JPG) for an edition — up to 20 pages</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Publication selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Publication
                  </label>
                  <select
                    value={selectedPreset}
                    onChange={e => setSelectedPreset(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 appearance-none cursor-pointer"
                  >
                    {PUBLICATION_PRESETS.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {selectedPreset === "custom" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Custom Name
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      placeholder="Enter publication name..."
                      className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={pubDate}
                    onChange={e => setPubDate(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Edition Label
                </label>
                <input
                  type="text"
                  value={editionLabel}
                  onChange={e => setEditionLabel(e.target.value)}
                  placeholder="e.g. Dhaka Edition, Final Print"
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Pages to OCR
                </label>
                <input
                  type="text"
                  value={ocrPagesInput}
                  onChange={e => setOcrPagesInput(e.target.value)}
                  placeholder="e.g. 1, 3, last"
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Comma-separated pages to extract. Supports &quot;last&quot;, &quot;all&quot;, and ranges like &quot;1-7&quot;.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { label: "Front + 2 + 3 + Last", value: "1, 2, 3, last" },
                    { label: "Front + 3 + Last", value: "1, 3, last" },
                    { label: "First 7", value: "1-7" },
                    { label: "All Uploaded", value: "all" },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setOcrPagesInput(preset.value)}
                      className="rounded-md border border-slate-700/70 bg-slate-800/50 px-2.5 py-1 text-[10px] font-bold text-slate-400 transition-colors hover:border-blue-500/50 hover:text-blue-300"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* File Drop Zone */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Page Scans / PDF
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !pdfExtracting && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 relative overflow-hidden ${
                    isDragging
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-slate-700/60 hover:border-blue-500/50 bg-slate-800/30"
                  } ${pdfExtracting ? "cursor-wait opacity-80" : ""}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpg,image/jpeg,image/webp,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    multiple
                    disabled={pdfExtracting}
                  />
                  {pdfExtracting ? (
                    <>
                      <RefreshCw className="h-10 w-10 text-blue-400 animate-spin" />
                      <div>
                        <p className="text-sm font-bold text-blue-300">
                          Extracting PDF Pages...
                        </p>
                        <p className="text-xs text-slate-400 mt-1 font-mono">
                          {pdfProgress}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className={`h-10 w-10 ${isDragging ? "text-blue-400" : "text-slate-600"}`} />
                      <div>
                        <p className="text-sm font-bold text-slate-300">
                          Drag & Drop pages or PDF
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          PNG, JPG, WEBP, PDF • Up to 20 pages • Click to browse
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Attached Files List */}
              {attachedFiles.length > 0 && (
                <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      {attachedFiles.length} page(s) attached
                    </span>
                    <button
                      onClick={() => setAttachedFiles([])}
                      className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-950/40 hover:bg-red-950/60 rounded transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {attachedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="relative group bg-slate-900/60 rounded-lg p-2 border border-slate-700/40 flex items-center gap-2"
                      >
                        <div className="w-8 h-8 bg-slate-700/60 rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-slate-400 font-mono">{idx + 1}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 truncate flex-1 font-mono">
                          {file.name}
                        </span>
                        <button
                          onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-300 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span className="font-bold">
                      {uploadProgress < 75 
                        ? "Uploading page scans..." 
                        : "Ingesting & compiling edition summaries..."
                      }
                    </span>
                    <span className="font-mono">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full"
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={isUploading || attachedFiles.length === 0 || !pubDate}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 disabled:shadow-none"
              >
                <Upload className="w-4 h-4" />
                Upload {attachedFiles.length > 0 ? `${attachedFiles.length} Pages` : "Edition"}
              </button>
            </div>
          </div>

          {/* Quick Seed Buttons */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-900 rounded-2xl border border-slate-800/80 p-5">
            <div className="flex items-start gap-4">
              <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/20 flex-shrink-0">
                <FolderOpen className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm text-slate-200">Seed Sample Newspapers</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Load pre-configured sample newspaper pages from the project directory. 
                  This will copy sample images and execute the dynamic OCR analysis pipeline.
                </p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    onClick={handleSeedProthomAlo}
                    disabled={isSeeding || isSeedingSamakal}
                    className="px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 text-amber-300 font-bold text-xs rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSeeding ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FolderOpen className="w-3.5 h-3.5" />
                    )}
                    {isSeeding ? "Seeding Prothom Alo..." : "Seed Prothom Alo (17 Pages)"}
                  </button>

                  <button
                    onClick={handleSeedSamakal}
                    disabled={isSeeding || isSeedingSamakal}
                    className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-300 font-bold text-xs rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSeedingSamakal ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FolderOpen className="w-3.5 h-3.5" />
                    )}
                    {isSeedingSamakal ? "Seeding Samakal..." : "Seed Samakal (1,2,3,last)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Existing Editions Panel — Right 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800/60 overflow-hidden sticky top-24">
            <div className="p-5 border-b border-slate-800/60 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600/20 p-2 rounded-lg">
                  <FolderOpen className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-white">Existing Editions</h2>
                  <p className="text-xs text-slate-500">{totalEditions} editions across {publications.length} publications</p>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
              {isLoadingEditions ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-6 h-6 text-slate-600 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading editions...</p>
                </div>
              ) : publications.length === 0 ? (
                <div className="p-8 text-center">
                  <FolderOpen className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-500">No editions uploaded yet</p>
                  <p className="text-xs text-slate-600 mt-1">Upload page scans or seed sample data</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/40">
                  {publications.map(pub => (
                    <div key={pub.id} className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Newspaper className="w-4 h-4 text-blue-400" />
                        <h3 className="font-bold text-sm text-white">{pub.name}</h3>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono ml-auto">
                          {pub.editions.length} edition{pub.editions.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {pub.editions.map(ed => (
                          <div
                            key={`${ed.publicationId}-${ed.date}`}
                            className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 group hover:bg-slate-800/60 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              <div>
                                <p className="text-xs font-bold text-slate-300">{ed.date}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{ed.edition}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-blue-950/50 text-blue-400 px-2 py-0.5 rounded font-bold border border-blue-800/30">
                                {ed.pageCount} pages
                              </span>
                              <a
                                href={`/?pub=${ed.publicationId}&date=${ed.date}`}
                                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                View →
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteEdition(ed)}
                                disabled={deletingEditionKey === `${ed.publicationId}-${ed.date}`}
                                className="p-1.5 text-slate-500 hover:text-red-300 hover:bg-red-500/10 rounded-md opacity-70 hover:opacity-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete edition"
                                aria-label={`Delete ${ed.publicationName} ${ed.date}`}
                              >
                                {deletingEditionKey === `${ed.publicationId}-${ed.date}` ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
