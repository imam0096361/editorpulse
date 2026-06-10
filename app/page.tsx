"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Newspaper,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  FileText,
  Copy,
  Layers,
  Settings,
  Calendar,
  Eye,
  BookOpen,
  ZoomIn,
  ZoomOut,
  Maximize,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
} from "lucide-react";
import { EditorPulseLogo } from "@/components/editor-pulse-logo";
import { cn } from "@/lib/utils";

// Types
interface NewsStory {
  title: string;
  subheadline?: string;
  byline?: string;
  author?: string;
  category: string;
  summary: string;
  originPage: string;
  jumpMerged?: string;
  jumpDetails?: string;
}

interface Publication {
  id: string;
  name: string;
  date: string;
  edition: string;
  pageCount: number;
  frontPage: NewsStory[];
  pageThree: NewsStory[];
  backPage: NewsStory[];
  ocrConfidence: number;
}

interface EditionInfo {
  publicationId: string;
  publicationName: string;
  date: string;
  edition: string;
  pageCount: number;
  pages: string[];
  frontPage?: NewsStory[];
  pageThree?: NewsStory[];
  backPage?: NewsStory[];
  ocrConfidence?: number;
}

interface PublicationGroup {
  id: string;
  name: string;
  editions: EditionInfo[];
}

// Hardcoded summary data for existing publications
const summaryPublications: Publication[] = [
  {
    id: "daily-star",
    name: "The Daily Star",
    date: "Oct 24, 2023",
    edition: "Final Print Edition",
    pageCount: 12,
    ocrConfidence: 98,
    frontPage: [
      {
        title: "Economy faces new headwinds amid global shifting",
        subheadline: "Inflation spike poses challenges as imports grow costlier across regional supply chains",
        byline: "Dhaka Correspondent",
        author: "Refayet Ullah Mirdha",
        category: "Lead",
        originPage: "P.01",
        jumpMerged: "P.04",
        summary: "The central bank reported a sudden surge in inflation rates as import costs spiked. Industry experts suggest structural reforms are needed immediately to stabilize currency fluctuations. Additional details from the Page 4 continuation highlight specific tight credit limits and reserve preservation measures deployed by commercial entities.",
        jumpDetails: "Jump News trace detected: 'Continued on Page 4 Column 3'. OCR aligned and extracted 320 trailing words."
      },
      {
        title: "Renewable Energy Policy: Draft Law Sent to Cabinet",
        subheadline: "Draft legislation aims at 20% clean grid contribution by 2030 through green incentives",
        byline: "Secretariat Desk",
        author: "Senior Correspondent",
        category: "Policy",
        originPage: "P.01",
        summary: "A new legal framework for green energy will see significant tax breaks for solar farms and wind projects across the coastal belt."
      },
    ],
    pageThree: [
      {
        title: "NBR scales up online tax filing support with custom portal helpdesks",
        subheadline: "Custom portal helpdesks set up dynamically across major business zones",
        byline: "Tax Desk",
        author: "Ahmed Shovon",
        category: "National",
        originPage: "P.03",
        jumpMerged: "P.04",
        summary: "The National Board of Revenue launched dedicated helpline centers in major business zones. Tax consultants praise the rapid data reconciliation features.",
        jumpDetails: "Page 3 Jump Matching Trace: Detected continuation indicator on Page 4 Column 2."
      },
    ],
    backPage: [
      {
        title: "Local Sports: National Team Training Camp Begins",
        subheadline: "Top fast-bowlers placed under special endurance modules",
        byline: "Sports Correspondent",
        author: "Mazhar Uddin",
        category: "Sports",
        originPage: "P.12",
        jumpMerged: "P.09",
        summary: "Players gathered at the National Stadium for an intensive 3-week camp under strict coaching supervision.",
        jumpDetails: "Jump News trace: 'Sports roundup contd. on Page 9'."
      },
    ]
  },
  {
    id: "prothom-alo",
    name: "প্রথম আলো (Prothom Alo)",
    date: "Jun 03, 2026",
    edition: "Dhaka Edition",
    pageCount: 16,
    ocrConfidence: 96,
    frontPage: [
      {
        title: "মূল্যস্ফীতি নিয়ন্ত্রণে কঠোর পদক্ষেপের নির্দেশ প্রধানমন্ত্রীর",
        subheadline: "চালের ওপর আমদানি শুল্ক প্রত্যাহার, মজুতদারদের বিরুদ্ধে আজ থেকেই মোবাইল কোর্টের নির্দেশ",
        byline: "ঢাকা",
        author: "শেখ সাবিহা ইয়াসমিন",
        category: "গুরুত্বপূর্ণ (Lead)",
        originPage: "P.01",
        jumpMerged: "P.04",
        summary: "বাজারে নিত্যপ্রয়োজনীয় পণ্যের দর নিয়ন্ত্রণে কঠোর নির্দেশনা দিয়েছেন প্রধানমন্ত্রী।",
        jumpDetails: "জাম্প নিউজ ট্র্যাকিং: 'পৃষ্ঠা ৪ কলাম ২-এ বিস্তারিত দেখুন'।"
      },
    ],
    pageThree: [
      {
        title: "রাজধানীর বস্তিবাসীদের পুনর্বাসনে ৩০০ নতুন ফ্ল্যাট হস্তান্তর প্রকল্প চূড়ান্ত",
        subheadline: "আধুনিক সুযোগ-সুবিধা সম্বলিত পরিবেশ বান্ধব আবাসন ব্যবস্থার বাস্তবায়ন",
        byline: "নগর প্রতিবেদক",
        author: "আসিফুর রহমান",
        category: "নগর উন্নয়ন",
        originPage: "P.03",
        summary: "সরকারি অর্থায়নে ভাসমান ও নিম্নআয়ের পরিবারের উন্নত আবাসন নিশ্চিত করতে আধুনিক সুযোগ-সুবিধা সম্বলিত ফ্ল্যাট হস্তান্তর শুরু হবে।",
      },
    ],
    backPage: [
      {
        title: "টি-টোয়েন্টি বিশ্বকাপ: প্রথম ম্যাচেই জয়ের লক্ষ্য বাংলাদেশের",
        subheadline: "সহায়ক উইকেটে তিন স্পিনার নিয়ে শক্তিশালী একাদশ",
        byline: "ক্রীড়া প্রতিবেদক",
        author: "তারেক মাহমুদ",
        category: "খেলাধুলা",
        originPage: "P.16",
        jumpMerged: "P.11",
        summary: "তিন স্পিনারের অন্তর্ভুক্তি শক্তিশালী বোলিং লাইনআপ এনে দিয়েছে।",
        jumpDetails: "জাম্প ট্র্যাকিং: 'ক্রীড়াজগৎ পি.১১'।"
      },
    ]
  },
  {
    id: "samakal",
    name: "সমকাল (Samakal)",
    date: "Jun 03, 2026",
    edition: "Dhaka Print",
    pageCount: 16,
    ocrConfidence: 97,
    frontPage: [
      {
        title: "তৈরি পোশাক খাতে মজুরি বোর্ড গঠনের দাবি শ্রমিকদের",
        subheadline: "মূল্যস্ফীতির সঙ্গে সামঞ্জস্য রেখে ন্যূনতম মজুরি ২৫ হাজার টাকা নির্ধারণের দাবি",
        byline: "ঢাকা",
        author: "আলামিন হোসেন",
        category: "জাতীয়",
        originPage: "P.01",
        jumpMerged: "P.04",
        summary: "তৈরি পোশাক খাতের শ্রমিকরা নতুন মজুরি বোর্ড গঠনের দাবি জানিয়েছেন।",
        jumpDetails: "জাম্প নিউজ ট্র্যাকিং: 'পৃষ্ঠা ৪ কলাম ৫-এ বিস্তারিত দেখুন'।"
      },
    ],
    pageThree: [
      {
        title: "ঢাকা ওয়াসা পানির দাম বাড়ানোর প্রস্তাব নাকচ করলো মন্ত্রণালয়",
        subheadline: "চাহিদা অনুযায়ী সেবা নিশ্চিত না করে অতিরিক্ত বোঝা চাপানো যাবে না",
        byline: "নগর প্রতিবেদক",
        author: "তানভীর আহমেদ",
        category: "নগর উন্নয়ন",
        originPage: "P.03",
        summary: "রাজধানীর গ্রাহকদের সুষ্ঠু পানি সরবরাহ নিশ্চিত না করে পানির দাম বাড়ানোর প্রস্তাব গ্রহণযোগ্য নয়।",
      },
    ],
    backPage: [
      {
        title: "খেলাধুলা: বড় জয়ে সেমিফাইনালের পথে বাংলাদেশ অনূর্ধ্ব-১৯ দল",
        subheadline: "ব্যাট-বলে অলরাউন্ড পারফরম্যান্সে দুর্দান্ত খেলে ভারতকে উড়িয়ে দিল যুবারা",
        byline: "ক্রীড়া প্রতিবেদক",
        author: "সৈয়দ ফয়েজ আহমেদ",
        category: "ক্রীড়া",
        originPage: "P.16",
        jumpMerged: "P.12",
        summary: "যুব এশিয়া কাপ ক্রিকেটে আজ বড় ব্যবধানে জয় লাভ করেছে টিম বাংলাদেশ।",
        jumpDetails: "জাম্প ট্র্যাকিং: 'যুব এশিয়া কাপ কন্টিনুয়েশন পৃষ্ঠা ১২'।"
      },
    ]
  }
];

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const handle = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(handle);
  }, []);

  // Sidebar / navigation
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedPubId, setSelectedPubId] = useState<string>("prothom-alo");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // View mode: "pages" for page viewer, "summary" for AI summary
  const [viewMode, setViewMode] = useState<"pages" | "summary">("pages");

  // Page Viewer state
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [editionMeta, setEditionMeta] = useState<EditionInfo | null>(null);
  const [isLoadingPages, setIsLoadingPages] = useState(false);

  // Publications from backend (uploaded editions)
  const [uploadedPubs, setUploadedPubs] = useState<PublicationGroup[]>([]);
  const [isLoadingPubs, setIsLoadingPubs] = useState(true);

  // Story detail drawer
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);

  // Summary view tab
  const [activeColumnTab, setActiveColumnTab] = useState<"front" | "pageThree" | "back">("front");

  const thumbnailStripRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Fetch uploaded publications
  const fetchPublications = useCallback(async () => {
    setIsLoadingPubs(true);
    try {
      const res = await fetch("/api/editions");
      const data = await res.json();
      setUploadedPubs(data.publications || []);
    } catch (err) {
      console.error("Failed to fetch publications:", err);
    } finally {
      setIsLoadingPubs(false);
    }
  }, []);

  // Auto-seed Prothom Alo on first load
  const seedProthomAlo = useCallback(async () => {
    try {
      await fetch("/api/seed", { method: "POST" });
      await fetchPublications();
    } catch { /* ignore */ }
  }, [fetchPublications]);

  useEffect(() => {
    seedProthomAlo();
  }, [seedProthomAlo]);

  // Fetch edition pages when a publication+date is selected
  const fetchEditionPages = useCallback(async (pubId: string, date: string) => {
    setIsLoadingPages(true);
    try {
      const res = await fetch(`/api/editions/${pubId}/${date}`);
      const data = await res.json();
      if (data.pages && data.pages.length > 0) {
        setPageImages(data.pages);
        setEditionMeta(data);
        setCurrentPage(0);
        setZoom(1);
      } else {
        setPageImages([]);
        setEditionMeta(null);
      }
    } catch {
      setPageImages([]);
      setEditionMeta(null);
    } finally {
      setIsLoadingPages(false);
    }
  }, []);

  // When selectedPubId or selectedDate changes, load pages
  useEffect(() => {
    if (selectedPubId && selectedDate) {
      fetchEditionPages(selectedPubId, selectedDate);
    } else if (selectedPubId && !selectedDate) {
      // Auto-select latest edition for this pub
      const pub = uploadedPubs.find(p => p.id === selectedPubId);
      if (pub && pub.editions.length > 0) {
        const latestDate = pub.editions[0].date;
        setSelectedDate(latestDate);
      } else {
        setPageImages([]);
        setEditionMeta(null);
        // No uploaded pages, show summary view
        setViewMode("summary");
      }
    }
  }, [selectedPubId, selectedDate, uploadedPubs, fetchEditionPages]);

  // URL params handling
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const pub = params.get('pub');
      const date = params.get('date');
      if (pub) setSelectedPubId(pub);
      if (date) setSelectedDate(date);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== "pages" || pageImages.length === 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setCurrentPage(prev => Math.min(prev + 1, pageImages.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentPage(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentPage(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentPage(pageImages.length - 1);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom(prev => Math.min(prev + 0.25, 3));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom(prev => Math.max(prev - 0.25, 0.5));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, pageImages.length]);

  // Auto scroll thumbnail strip to active
  useEffect(() => {
    if (thumbnailStripRef.current) {
      const activeThumb = thumbnailStripRef.current.children[currentPage] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [currentPage]);

  // Get active summary publication (dynamic from API if available, otherwise fallback to hardcoded mocks)
  const activeSummaryPub = (editionMeta && editionMeta.frontPage && editionMeta.frontPage.length > 0)
    ? {
        id: editionMeta.publicationId,
        name: editionMeta.publicationName,
        date: editionMeta.date,
        edition: editionMeta.edition,
        pageCount: editionMeta.pageCount || pageImages.length,
        frontPage: editionMeta.frontPage || [],
        pageThree: editionMeta.pageThree || [],
        backPage: editionMeta.backPage || [],
        ocrConfidence: editionMeta.ocrConfidence || 95,
        isDynamic: true,
      }
    : (summaryPublications.find(p => p.id === selectedPubId) || summaryPublications[0]);

  const isProthomAlo = selectedPubId === "prothom-alo" || activeSummaryPub.name.toLowerCase().includes("prothom") || activeSummaryPub.name.includes("প্রথম আলো");

  const pageThreeLabel = (activeSummaryPub.pageThree && activeSummaryPub.pageThree.length > 0 && activeSummaryPub.pageThree[0].originPage)
    ? activeSummaryPub.pageThree[0].originPage
    : (isProthomAlo ? "P.02" : "P.03");

  const pageThreeTitle = (activeSummaryPub.pageThree && activeSummaryPub.pageThree.length > 0 && activeSummaryPub.pageThree[0].originPage)
    ? `Page ${activeSummaryPub.pageThree[0].originPage.replace("P.", "").replace("P", "")}`
    : (isProthomAlo ? "Page 2" : "Page 3");

  // Check if this pub has uploaded pages
  const hasUploadedPages = pageImages.length > 0;

  // Build sidebar publication list combining uploaded and summary-only pubs
  const allPubIds = new Set<string>();
  const sidebarPubs: { id: string; name: string; hasPages: boolean; editions: EditionInfo[] }[] = [];

  for (const up of uploadedPubs) {
    allPubIds.add(up.id);
    sidebarPubs.push({
      id: up.id,
      name: up.name,
      hasPages: true,
      editions: up.editions,
    });
  }

  for (const sp of summaryPublications) {
    if (!allPubIds.has(sp.id)) {
      allPubIds.add(sp.id);
      sidebarPubs.push({
        id: sp.id,
        name: sp.name,
        hasPages: false,
        editions: [],
      });
    }
  }

  // Copy and Export utilities
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportAsJSON = (pub: Publication) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pub, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `${pub.id}-summary.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-mono text-slate-400">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Initializing EditorPulse Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="app-root" className="flex flex-col md:flex-row h-screen w-screen bg-[#F3F4F6] text-slate-800 font-sans overflow-hidden">

      {/* Mobile Top Navigation */}
      <header className="md:hidden flex h-16 w-full items-center justify-between border-b bg-[#1E293B] px-4 text-white z-20">
        <div className="flex items-center gap-2">
          <EditorPulseLogo className="h-9 w-9 rounded-xl shadow-lg shadow-cyan-950/40" />
          <h1 className="font-bold text-lg tracking-tight uppercase">
            Editor<span className="text-blue-400">Pulse</span>
          </h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 text-slate-200 hover:text-white"
          id="mobile-menu-toggle"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        id="sidebar-nav"
        className={cn(
          "w-72 bg-[#1E293B] flex-shrink-0 flex flex-col z-30 transition-all duration-300",
          "fixed inset-y-0 left-0 md:relative md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-6 border-b border-slate-700 hidden md:block">
          <div className="flex items-center gap-3">
            <EditorPulseLogo className="h-12 w-12 rounded-2xl shadow-xl shadow-cyan-950/40 ring-1 ring-white/10" />
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight uppercase leading-none">
                Editor<span className="text-blue-400">Pulse</span>
              </h1>
              <p className="text-slate-400 text-[10px] mt-1 font-mono tracking-wider uppercase">Newspaper Viewer</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto min-h-0 px-2 space-y-1">
          <div className="px-3 mb-3 text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex justify-between items-center">
            <span>Publications</span>
            <button onClick={fetchPublications} className="hover:text-slate-300 transition-colors">
              <RefreshCw className={`w-3 h-3 ${isLoadingPubs ? "animate-spin" : ""}`} />
            </button>
          </div>

          {sidebarPubs.map((pub) => {
            const isActive = pub.id === selectedPubId;
            return (
              <div key={pub.id} className="mb-1">
                <button
                  onClick={() => {
                    setSelectedPubId(pub.id);
                    setSelectedDate(null);
                    setMobileMenuOpen(false);
                    if (pub.hasPages) {
                      setViewMode("pages");
                    } else {
                      setViewMode("summary");
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all duration-150 group",
                    isActive
                      ? "bg-blue-600/20 border-l-4 border-blue-500 text-blue-100 font-semibold"
                      : "hover:bg-slate-800/60 text-slate-400 hover:text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0 transition-all",
                      isActive ? "bg-blue-400 shadow-sm shadow-blue-400" : "bg-slate-600 group-hover:bg-slate-400"
                    )} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate leading-snug">{pub.name}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5 leading-none">
                        {pub.hasPages
                          ? `${pub.editions.length} edition${pub.editions.length !== 1 ? "s" : ""} uploaded`
                          : "Summary only"
                        }
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity",
                    isActive && "opacity-100 text-blue-400"
                  )} />
                </button>

                {/* Edition sub-items */}
                {isActive && pub.hasPages && pub.editions.length > 0 && (
                  <div className="ml-6 mt-1 space-y-0.5 border-l border-slate-700/50 pl-3">
                    {pub.editions.map(ed => (
                      <button
                        key={ed.date}
                        onClick={() => {
                          setSelectedDate(ed.date);
                          setViewMode("pages");
                          setMobileMenuOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-xs transition-all",
                          selectedDate === ed.date
                            ? "bg-blue-600/15 text-blue-300 font-bold"
                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {ed.date}
                        </span>
                        <span className="text-[9px] font-mono bg-slate-800/60 px-1.5 py-0.5 rounded">
                          {ed.pageCount}p
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Admin Link */}
        <div className="p-3 border-t border-slate-800">
          <a
            href="/admin"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-600/20 transition-all"
          >
            <Settings className="h-4 w-4" />
            Admin — Upload Editions
          </a>
        </div>

        <div className="p-3 bg-slate-900 border-t border-slate-800 text-slate-500 text-[10px] text-center font-mono">
          EditorPulse v5.0 • Professional
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">

        {/* Top Header Bar */}
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 font-sans tracking-tight truncate">
              {editionMeta?.publicationName || activeSummaryPub.name}
            </h2>
            {(editionMeta || (activeSummaryPub as any).isDynamic) && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center bg-slate-100 rounded-lg px-2 py-1 text-[11px] border border-slate-200">
                  <span className="font-bold text-slate-500 mr-1 uppercase font-mono">Date:</span>
                  <span className="text-slate-700 font-medium">{editionMeta?.date || activeSummaryPub.date}</span>
                </div>
                <div className="flex items-center bg-slate-100 rounded-lg px-2 py-1 text-[11px] border border-slate-200">
                  <span className="font-bold text-slate-500 mr-1 uppercase font-mono">Pages:</span>
                  <span className="text-slate-700 font-medium">{editionMeta?.pageCount || activeSummaryPub.pageCount}</span>
                </div>
                {((activeSummaryPub as any).isDynamic) && (
                  <div className="flex items-center bg-emerald-50 text-emerald-700 rounded-lg px-2.5 py-1 text-[11px] border border-emerald-200 font-bold font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse inline-block" />
                    Gemini AI Summary
                  </div>
                )}
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode("pages")}
                disabled={!hasUploadedPages}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5",
                  viewMode === "pages"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                  !hasUploadedPages && "opacity-40 cursor-not-allowed"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pages</span>
              </button>
              <button
                onClick={() => setViewMode("summary")}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5",
                  viewMode === "summary"
                    ? "bg-white text-purple-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Summary</span>
              </button>
            </div>

            {viewMode === "summary" && (
              <div className="hidden md:flex gap-1.5">
                <button
                  onClick={() => exportAsJSON(activeSummaryPub)}
                  className="px-3 py-1.5 hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-all flex items-center gap-1"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Export
                </button>
                <button
                  onClick={() => {
                    const report = `=== ${activeSummaryPub.name} (${activeSummaryPub.date}) ===\n\nFRONT PAGE:\n${activeSummaryPub.frontPage.map(s => `- ${s.title}: ${s.summary}`).join('\n')}\n\nPAGE THREE:\n${(activeSummaryPub.pageThree || []).map(s => `- ${s.title}: ${s.summary}`).join('\n')}\n\nBACK PAGE:\n${activeSummaryPub.backPage.map(s => `- ${s.title}: ${s.summary}`).join('\n')}`;
                    copyToClipboard(report);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ========================================= */}
        {/* PAGE VIEWER MODE */}
        {/* ========================================= */}
        {viewMode === "pages" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0B1120]">
            {isLoadingPages ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 text-slate-500 animate-spin" />
                  <p className="text-sm text-slate-500 font-mono">Loading pages...</p>
                </div>
              </div>
            ) : pageImages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                  <Newspaper className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-400 mb-2">No Pages Uploaded</h3>
                  <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                    This publication doesn&apos;t have any uploaded newspaper pages yet.
                    Visit the Admin panel to upload page scans.
                  </p>
                  <a
                    href="/admin"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    Go to Admin
                  </a>
                </div>
              </div>
            ) : (
              <>
                {/* Page Info Bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-[#0F172A] border-b border-slate-800/50 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    {/* Quick jump buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(0)}
                        className={cn(
                          "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all border",
                          currentPage === 0
                            ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                            : "text-slate-400 hover:text-white border-slate-700/50 hover:border-slate-600"
                        )}
                      >
                        Page 1
                      </button>
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={pageImages.length < 2}
                        className={cn(
                          "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all border",
                          currentPage === 1
                            ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                            : "text-slate-400 hover:text-white border-slate-700/50 hover:border-slate-600",
                          pageImages.length < 2 && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        Page 2
                      </button>
                      <button
                        onClick={() => setCurrentPage(pageImages.length - 1)}
                        className={cn(
                          "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all border",
                          currentPage === pageImages.length - 1
                            ? "bg-amber-600/20 text-amber-400 border-amber-500/30"
                            : "text-slate-400 hover:text-white border-slate-700/50 hover:border-slate-600"
                        )}
                      >
                        Last ({pageImages.length})
                      </button>
                    </div>

                    <div className="w-px h-5 bg-slate-700/50" />

                    {/* Page number indicator */}
                    <span className="text-sm font-bold text-white font-mono">
                      Page <span className="text-blue-400">{currentPage + 1}</span>
                      <span className="text-slate-500"> / {pageImages.length}</span>
                    </span>
                  </div>

                  {/* Jump to page input */}
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Jump to:</label>
                    <input
                      type="number"
                      min={1}
                      max={pageImages.length}
                      value={currentPage + 1}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        if (val >= 1 && val <= pageImages.length) {
                          setCurrentPage(val - 1);
                        }
                      }}
                      className="w-14 bg-slate-800/60 border border-slate-700/50 rounded px-2 py-1 text-xs text-white text-center font-mono focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Main Page Viewer */}
                <div ref={viewerRef} className="flex-1 relative overflow-hidden">
                  {/* Navigation Arrows */}
                  <button
                    className="page-nav-btn prev"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    className="page-nav-btn next"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageImages.length - 1))}
                    disabled={currentPage === pageImages.length - 1}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>

                  {/* Page Image */}
                  <div 
                    className="w-full h-full overflow-auto flex p-4"
                    style={{
                      justifyContent: zoom > 1 ? "flex-start" : "center",
                      alignItems: zoom > 1 ? "flex-start" : "center"
                    }}
                  >
                    <AnimatePresence mode="wait">
                      <div
                        key={currentPage}
                        className="relative flex items-center justify-center"
                        style={{
                          width: zoom === 1 ? "100%" : `${zoom * 100}%`,
                          height: zoom === 1 ? "100%" : "auto",
                          transition: "width 0.2s ease, height 0.2s ease",
                          margin: "auto"
                        }}
                      >
                        <motion.img
                          src={pageImages[currentPage]}
                          alt={`Page ${currentPage + 1}`}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.2 }}
                          style={{
                            maxWidth: "100%",
                            maxHeight: zoom === 1 ? "100%" : "none",
                            objectFit: "contain",
                          }}
                          className="rounded shadow-2xl"
                          draggable={false}
                        />
                      </div>
                    </AnimatePresence>
                  </div>

                  {/* Zoom Controls */}
                  <div className="zoom-controls">
                    <button className="zoom-btn" onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.25))}>
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="zoom-btn text-xs font-mono text-slate-400 cursor-default">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button className="zoom-btn" onClick={() => setZoom(prev => Math.min(prev + 0.25, 4))}>
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button className="zoom-btn" onClick={() => setZoom(1)}>
                      <Maximize className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Navigation Bar */}
                <div className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] border-t border-slate-800/50 flex-shrink-0">
                  <button
                    onClick={() => setCurrentPage(0)}
                    disabled={currentPage === 0}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="First Page"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
                    disabled={currentPage === 0}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous Page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  {/* Thumbnail Strip */}
                  <div ref={thumbnailStripRef} className="thumbnail-strip flex-1">
                    {pageImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPage(idx)}
                        className={cn("thumbnail-item", currentPage === idx && "active")}
                        title={`Page ${idx + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={`Page ${idx + 1} thumbnail`} loading="lazy" />
                        <span className="thumbnail-page-label">{idx + 1}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageImages.length - 1))}
                    disabled={currentPage === pageImages.length - 1}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next Page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(pageImages.length - 1)}
                    disabled={currentPage === pageImages.length - 1}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Last Page"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================= */}
        {/* SUMMARY VIEW MODE */}
        {/* ========================================= */}
        {viewMode === "summary" && (
          <>
            {/* Responsive Tabs bar for mobile */}
            <div className="xl:hidden px-6 pt-4 bg-[#F8FAFC] flex-shrink-0">
              <div className="flex bg-slate-200/60 p-1.5 rounded-2xl border border-slate-200/80 gap-1 shadow-2xs">
                <button
                  onClick={() => setActiveColumnTab("front")}
                  className={cn(
                    "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer text-center",
                    activeColumnTab === "front"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  P.01 Front Page
                </button>
                <button
                  onClick={() => setActiveColumnTab("pageThree")}
                  className={cn(
                    "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer text-center",
                    activeColumnTab === "pageThree"
                      ? "bg-white text-purple-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  {pageThreeLabel} {pageThreeTitle}
                </button>
                <button
                  onClick={() => setActiveColumnTab("back")}
                  className={cn(
                    "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer text-center",
                    activeColumnTab === "back"
                      ? "bg-white text-amber-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  P.{activeSummaryPub.pageCount.toString().padStart(2, "0")} Back
                </button>
              </div>
            </div>

            {/* 3-Column News Summary View */}
            <div className="flex-1 flex flex-col xl:flex-row gap-6 p-6 overflow-y-auto xl:overflow-hidden bg-[#F8FAFC]">

              {/* Column: Front Page */}
              <section className={cn(
                "flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs transition-all",
                activeColumnTab !== "front" && "hidden xl:flex"
              )}>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-slate-900 text-white text-[11px] font-bold px-2 py-0.5 rounded-md font-mono">P.01</span>
                    <h3 className="font-black text-lg text-slate-950 font-sans tracking-tight">Front Page</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-medium italic">
                    {activeSummaryPub.frontPage.length} stories
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                  {activeSummaryPub.frontPage.map((story, i) => (
                    <article
                      key={i}
                      onClick={() => setSelectedStory(story)}
                      className="rounded-xl p-4 bg-white border border-slate-200/95 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-2 gap-3">
                        <h4 className="font-black text-base text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                          {story.title}
                        </h4>
                        <span className={cn(
                          "flex-shrink-0 text-[10px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider border",
                          story.category.toLowerCase().includes("lead") || story.category.includes("গুরুত্বপূর্ণ")
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {story.category}
                        </span>
                      </div>
                      {story.subheadline && (
                        <p className="text-xs text-slate-500 font-medium italic mb-2 leading-relaxed">{story.subheadline}</p>
                      )}
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-2">{story.summary}</p>
                      {story.jumpMerged && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-2">
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-blue-500" />
                            Jump Merged ({story.jumpMerged})
                          </span>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <div className="w-px bg-slate-200 hidden xl:block h-full" />

              {/* Column: Page Three */}
              <section className={cn(
                "flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs transition-all",
                activeColumnTab !== "pageThree" && "hidden xl:flex"
              )}>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-slate-900 text-white text-[11px] font-bold px-2 py-0.5 rounded-md font-mono">
                      {pageThreeLabel}
                    </span>
                    <h3 className="font-black text-lg text-slate-950 font-sans tracking-tight">
                      {pageThreeTitle}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-medium italic">
                    {(activeSummaryPub.pageThree || []).length} stories
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                  {(activeSummaryPub.pageThree || []).map((story, i) => (
                    <article
                      key={i}
                      onClick={() => setSelectedStory(story)}
                      className="rounded-xl p-4 bg-white border border-slate-200/95 hover:border-purple-300 hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-2 gap-3">
                        <h4 className="font-black text-base text-slate-900 leading-tight group-hover:text-purple-600 transition-colors">
                          {story.title}
                        </h4>
                        <span className="flex-shrink-0 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider">
                          {story.category}
                        </span>
                      </div>
                      {story.subheadline && (
                        <p className="text-xs text-slate-500 font-medium italic mb-2 leading-relaxed">{story.subheadline}</p>
                      )}
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-2">{story.summary}</p>
                      {story.jumpMerged && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-2">
                          <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 uppercase tracking-widest flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-purple-500" />
                            Jump Merged ({story.jumpMerged})
                          </span>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <div className="w-px bg-slate-200 hidden xl:block h-full" />

              {/* Column: Back Page */}
              <section className={cn(
                "flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs transition-all",
                activeColumnTab !== "back" && "hidden xl:flex"
              )}>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-slate-950 text-white text-[11px] font-bold px-2 py-0.5 rounded-md font-mono">
                      P.{activeSummaryPub.pageCount.toString().padStart(2, "0")}
                    </span>
                    <h3 className="font-black text-lg text-slate-950 font-sans tracking-tight">Back Page</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-medium italic">
                    {activeSummaryPub.backPage.length} features
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                  {activeSummaryPub.backPage.map((story, i) => (
                    <article
                      key={i}
                      onClick={() => setSelectedStory(story)}
                      className="rounded-xl p-4 bg-white border border-slate-200/95 hover:border-amber-300 hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-2 gap-3">
                        <h4 className="font-black text-base text-slate-900 leading-tight group-hover:text-amber-600 transition-colors">
                          {story.title}
                        </h4>
                        <span className="flex-shrink-0 bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] text-[10px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider">
                          {story.category}
                        </span>
                      </div>
                      {story.subheadline && (
                        <p className="text-xs text-slate-500 font-medium italic mb-2 leading-relaxed">{story.subheadline}</p>
                      )}
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-2">{story.summary}</p>
                      {story.jumpMerged && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-2">
                          <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase tracking-widest flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-amber-500" />
                            Jump Merged ({story.jumpMerged})
                          </span>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </div>

            {/* Footer */}
            <footer className="h-12 bg-slate-50 border-t flex items-center px-6 text-[11px] text-slate-500 justify-between flex-shrink-0">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
                  System Active
                </div>
              </div>
              <div className="font-mono text-[10px]">EditorPulse v5.0</div>
            </footer>
          </>
        )}
      </main>

      {/* Story Detail Drawer */}
      <AnimatePresence>
        {selectedStory && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStory(null)}
              className="absolute inset-0 bg-slate-900 cursor-pointer"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded font-mono">
                    {selectedStory.originPage}
                  </span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 uppercase py-0.5 px-2 rounded-md font-bold">
                    {selectedStory.category}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedStory(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                <div className="space-y-3 pb-4 border-b border-slate-100">
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                    {selectedStory.title}
                  </h3>
                  {selectedStory.subheadline && (
                    <p className="text-sm font-medium text-slate-600 leading-normal italic pl-3 border-l-2 border-slate-200">
                      {selectedStory.subheadline}
                    </p>
                  )}
                  {(selectedStory.author || selectedStory.byline) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono pt-2">
                      {selectedStory.author && (
                        <span>Reporter: <strong className="text-slate-800 font-semibold">{selectedStory.author}</strong></span>
                      )}
                      {selectedStory.byline && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span>Desk: <strong className="text-slate-800 font-semibold">{selectedStory.byline}</strong></span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">Summary</h4>
                  <div className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap">
                    {selectedStory.summary}
                  </div>
                </div>

                {selectedStory.jumpMerged && (
                  <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-5 space-y-2">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <h4 className="font-bold text-sm uppercase tracking-wide">
                        Jump Matching ({selectedStory.jumpMerged})
                      </h4>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-mono">
                      {selectedStory.jumpDetails}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button
                  onClick={() => copyToClipboard(`${selectedStory.title}\n\n${selectedStory.summary}`)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-extrabold rounded-lg transition-all"
                >
                  Copy Summary
                </button>
                <button
                  onClick={() => setSelectedStory(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-lg transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
