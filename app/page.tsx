"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  Search,
  Filter,
  Star,
  ClipboardList,
  AlertTriangle,
  GitCompare,
  CheckCircle2,
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

type ViewMode = "desk" | "pages" | "summary";
type DeskTab = "missed" | "matched" | "human_check" | "single" | "all";
type StorySection = "frontPage" | "pageThree" | "backPage";

interface NewsDeskStory {
  id: string;
  story: NewsStory;
  publicationId: string;
  publicationName: string;
  date: string;
  edition: string;
  pageCount: number;
  section: StorySection;
  sectionLabel: string;
  isMainPublication: boolean;
  comparisonScore: number;
  comparisonLabel: string;
  mainMatchId?: string;
  mainMatchTitle?: string;
}

interface StoryMatch {
  story: NewsDeskStory;
  score: number;
  evidence: string[];
  confirmed: boolean;
}

interface DailyStarCluster {
  anchor: NewsDeskStory;
  matches: StoryMatch[];
}

interface MissedStoryCluster {
  id: string;
  leadStory: NewsDeskStory;
  supportingStories: StoryMatch[];
  weakDailyStarCandidate?: StoryMatch;
  importanceScore: number;
  importanceReasons: string[];
  publicationCount: number;
  storyCount: number;
}

const MAIN_PUBLICATION_ID = "daily-star";

const deskTabs: { id: DeskTab; label: string; icon: React.ElementType }[] = [
  { id: "missed", label: "Daily Star Missed", icon: AlertTriangle },
  { id: "matched", label: "Daily Star Matched", icon: GitCompare },
  { id: "human_check", label: "Needs Human Check", icon: Search },
  { id: "single", label: "Single Publication", icon: Newspaper },
  { id: "all", label: "All Publications", icon: Layers },
];

const sectionLabels: Record<StorySection, string> = {
  frontPage: "Front",
  pageThree: "Inside",
  backPage: "Back",
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const isDailyStarPublication = (id: string, name: string) => {
  const normalizedId = normalizeText(id).replace(/\s+/g, "-");
  const normalizedName = normalizeText(name);
  return normalizedId.includes("daily-star") || normalizedName.includes("daily star");
};

const conceptLexicon: Record<string, string[]> = {
  economy: ["economy", "economic", "inflation", "price", "prices", "market", "import", "currency", "reserve", "bank", "মূল্যস্ফীতি", "দাম", "বাজার", "আমদানি", "মুদ্রা", "রিজার্ভ", "ব্যাংক"],
  politics: ["government", "minister", "cabinet", "parliament", "election", "policy", "law", "prime", "secretariat", "সরকার", "মন্ত্রী", "মন্ত্রিসভা", "সংসদ", "নির্বাচন", "নীতি", "আইন", "প্রধানমন্ত্রী"],
  energy: ["energy", "renewable", "solar", "wind", "grid", "power", "electricity", "জ্বালানি", "বিদ্যুৎ", "সৌর", "নবায়নযোগ্য", "গ্রিড"],
  tax: ["tax", "revenue", "nbr", "filing", "custom", "vat", "কর", "রাজস্ব", "এনবিআর", "ভ্যাট", "শুল্ক"],
  labour: ["labour", "labor", "worker", "wage", "garment", "rmg", "factory", "শ্রমিক", "মজুরি", "পোশাক", "কারখানা"],
  city: ["city", "metro", "dhaka", "water", "wasa", "housing", "flat", "rehabilitation", "capital", "ঢাকা", "রাজধানী", "ওয়াসা", "পানি", "আবাসন", "ফ্ল্যাট", "পুনর্বাসন"],
  sports: ["sports", "cricket", "team", "camp", "training", "match", "world cup", "semifinal", "খেলা", "খেলাধুলা", "ক্রীড়া", "ক্রিকেট", "দল", "বিশ্বকাপ", "সেমিফাইনাল"],
  education: ["school", "university", "student", "teacher", "exam", "education", "শিক্ষা", "বিদ্যালয়", "বিশ্ববিদ্যালয়", "শিক্ষার্থী", "পরীক্ষা"],
  crime: ["crime", "police", "court", "case", "arrest", "mobile court", "পুলিশ", "আদালত", "মামলা", "গ্রেপ্তার", "মোবাইল কোর্ট"],
  climate: ["climate", "weather", "flood", "cyclone", "coastal", "rain", "জলবায়ু", "আবহাওয়া", "বন্যা", "ঘূর্ণিঝড়", "উপকূল", "বৃষ্টি"],
};

const getStoryConcepts = (story: NewsStory) => {
  const text = normalizeText(`${story.title} ${story.subheadline || ""} ${story.category} ${story.summary}`);
  return new Set(
    Object.entries(conceptLexicon)
      .filter(([, terms]) => terms.some((term) => text.includes(normalizeText(term))))
      .map(([concept]) => concept)
  );
};

const tokenizeStory = (story: NewsStory) => {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "will", "into", "amid", "news",
    "page", "পৃষ্ঠা", "খবর", "এবং", "একটি", "করে", "নিয়ে", "জন্য", "থেকে", "হবে",
  ]);
  return new Set(
    normalizeText(`${story.title} ${story.subheadline || ""} ${story.category} ${story.summary}`)
      .split(" ")
      .filter((token) => token.length > 2 && !stopWords.has(token))
  );
};

const slugify = (value: string) =>
  normalizeText(value)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "story";

const broadConceptTerms = new Set(
  Object.values(conceptLexicon)
    .flat()
    .map((term) => normalizeText(term))
    .filter(Boolean)
);

const publicInterestPattern = /(government|minister|court|police|economy|inflation|bank|election|policy|law|budget|crime|worker|wage|flood|cyclone|disaster|parliament|cabinet|protest|corruption|সরকার|মন্ত্রী|আদালত|পুলিশ|অর্থনীতি|মূল্যস্ফীতি|ব্যাংক|নির্বাচন|নীতি|আইন|শ্রমিক|মজুরি|বন্যা|ঘূর্ণিঝড়|দুর্যোগ|সংসদ|দুর্নীতি)/;

const intersection = (left: Set<string>, right: Set<string>) =>
  Array.from(left).filter((item) => right.has(item));

const extractStorySignals = (story: NewsStory) => {
  const titleTokens = tokenizeStory({ ...story, summary: "", subheadline: "", category: "" });
  const allTokens = tokenizeStory(story);
  const factualTerms = new Set(
    Array.from(allTokens).filter((token) => (
      /\d/.test(token) ||
      token.length >= 5 ||
      /[\u0980-\u09FF]/.test(token)
    ))
  );
  const distinctiveTerms = new Set(
    Array.from(factualTerms).filter((token) => !broadConceptTerms.has(token) || /\d/.test(token))
  );
  const publicTerms = new Set(
    Array.from(allTokens).filter((token) => publicInterestPattern.test(token))
  );

  return {
    titleTokens,
    factualTerms,
    distinctiveTerms,
    publicTerms,
    concepts: getStoryConcepts(story),
  };
};

const scoreStrictStoryMatch = (story: NewsStory, candidate: NewsStory): {
  score: number;
  evidence: string[];
  confirmed: boolean;
} => {
  const left = extractStorySignals(story);
  const right = extractStorySignals(candidate);
  const sharedTitleTerms = intersection(left.titleTokens, right.titleTokens);
  const sharedDistinctiveTerms = intersection(left.distinctiveTerms, right.distinctiveTerms);
  const sharedPublicTerms = intersection(left.publicTerms, right.publicTerms);
  const sharedConcepts = intersection(left.concepts, right.concepts);
  const sharedNumbers = sharedDistinctiveTerms.filter((term) => /\d/.test(term));
  const headlineDenominator = Math.max(Math.min(left.titleTokens.size, right.titleTokens.size), 1);
  const headlineOverlap = sharedTitleTerms.length / headlineDenominator;
  const factualStrength = sharedDistinctiveTerms.length + sharedNumbers.length + Math.min(sharedPublicTerms.length, 2);
  const broadOnly = sharedDistinctiveTerms.length === 0 && sharedTitleTerms.length < 2;

  const score = Math.min(100, Math.round(
    headlineOverlap * 54 +
    Math.min(sharedDistinctiveTerms.length, 6) * 7 +
    Math.min(sharedNumbers.length, 3) * 8 +
    Math.min(sharedPublicTerms.length, 2) * 4
  ));

  const confirmed = !broadOnly && (
    (headlineOverlap >= 0.32 && factualStrength >= 3) ||
    (sharedTitleTerms.length >= 3 && factualStrength >= 2) ||
    (sharedNumbers.length > 0 && headlineOverlap >= 0.24 && factualStrength >= 2)
  );

  const evidence = [
    ...sharedTitleTerms.slice(0, 4).map((term) => `headline term: ${term}`),
    ...sharedDistinctiveTerms.slice(0, 6).map((term) => `factual term: ${term}`),
    ...sharedNumbers.slice(0, 2).map((term) => `number/date: ${term}`),
    ...sharedConcepts.slice(0, 2).map((term) => `topic context: ${term}`),
  ];

  return {
    score,
    evidence: Array.from(new Set(evidence)),
    confirmed,
  };
};

const getImportanceScore = (deskStory: NewsDeskStory) => {
  const text = normalizeText(`${deskStory.story.title} ${deskStory.story.category} ${deskStory.story.summary}`);
  let score = 18;

  if (deskStory.section === "frontPage" || deskStory.story.originPage.includes("01")) score += 34;
  if (deskStory.story.jumpMerged) score += 14;
  if (text.includes("lead") || text.includes("breaking") || text.includes("গুরুত্বপূর্ণ")) score += 16;
  if (/(government|minister|court|police|economy|inflation|bank|election|policy|law|budget|crime|worker|wage)/.test(text)) score += 12;
  if (/(সরকার|মন্ত্রী|আদালত|পুলিশ|অর্থনীতি|মূল্যস্ফীতি|ব্যাংক|নির্বাচন|নীতি|আইন|শ্রমিক|মজুরি)/.test(text)) score += 12;
  if (deskStory.section === "backPage" && /(sports|cricket|খেলাধুলা|ক্রীড়া|ক্রিকেট)/.test(text)) score -= 12;

  return Math.max(0, Math.min(100, score));
};

const getImportanceReasons = (clusterStories: NewsDeskStory[]) => {
  const leadStory = clusterStories[0];
  const reasons: string[] = [];
  const publicationCount = new Set(clusterStories.map((story) => story.publicationId)).size;
  const text = normalizeText(clusterStories.map((story) => `${story.story.title} ${story.story.category} ${story.story.summary}`).join(" "));

  if (publicationCount >= 2) reasons.push(`carried by ${publicationCount} non-Daily-Star publications`);
  if (clusterStories.some((story) => story.section === "frontPage" || story.story.originPage.includes("01"))) reasons.push("front-page placement");
  if (clusterStories.some((story) => story.story.jumpMerged)) reasons.push("jump story with continuation");
  if (publicInterestPattern.test(text)) reasons.push("public-interest subject");
  if (leadStory && getImportanceScore(leadStory) >= 58) reasons.push("high editorial importance score");

  return reasons.length > 0 ? reasons : ["single-source item; verify before escalating"];
};

const buildDailyStarClusters = (
  baselineStories: NewsDeskStory[],
  nonBaselineStories: NewsDeskStory[]
): DailyStarCluster[] => baselineStories
  .map((anchor) => ({
    anchor,
    matches: nonBaselineStories
      .map((story) => {
        const result = scoreStrictStoryMatch(story.story, anchor.story);
        return {
          story,
          score: result.confirmed ? 100 : result.score,
          evidence: result.evidence,
          confirmed: result.confirmed,
        };
      })
      .filter((match) => match.confirmed)
      .sort((a, b) => b.score - a.score),
  }))
  .filter((cluster) => cluster.matches.length > 0);

const buildMissedStoryClusters = (
  nonBaselineStories: NewsDeskStory[],
  baselineStories: NewsDeskStory[]
): MissedStoryCluster[] => {
  const confirmedDailyStarStoryIds = new Set(
    nonBaselineStories
      .filter((story) => baselineStories.some((baselineStory) => scoreStrictStoryMatch(story.story, baselineStory.story).confirmed))
      .map((story) => story.id)
  );
  const remainingStories = nonBaselineStories.filter((story) => !confirmedDailyStarStoryIds.has(story.id));
  const visited = new Set<string>();
  const clusters: MissedStoryCluster[] = [];

  for (const story of remainingStories) {
    if (visited.has(story.id)) continue;

    const supportingStories = remainingStories
      .filter((candidate) => candidate.id !== story.id && candidate.publicationId !== story.publicationId)
      .map((candidate) => {
        const result = scoreStrictStoryMatch(story.story, candidate.story);
        return {
          story: candidate,
          score: result.confirmed ? 100 : result.score,
          evidence: result.evidence,
          confirmed: result.confirmed,
        };
      })
      .filter((match) => match.confirmed)
      .sort((a, b) => b.score - a.score);

    const clusterStories = [story, ...supportingStories.map((match) => match.story)];
    clusterStories.forEach((clusterStory) => visited.add(clusterStory.id));
    const leadStory = clusterStories
      .slice()
      .sort((a, b) => getImportanceScore(b) - getImportanceScore(a))[0];
    const publicationCount = new Set(clusterStories.map((clusterStory) => clusterStory.publicationId)).size;
    const weakDailyStarCandidate = baselineStories
      .map((baselineStory) => {
        const result = scoreStrictStoryMatch(leadStory.story, baselineStory.story);
        return {
          story: baselineStory,
          score: result.score,
          evidence: result.evidence,
          confirmed: result.confirmed,
        };
      })
      .filter((match) => !match.confirmed && match.score >= 24)
      .sort((a, b) => b.score - a.score)[0];
    const reasons = getImportanceReasons(clusterStories);
    const importanceScore = Math.min(100, getImportanceScore(leadStory) + (publicationCount >= 2 ? 22 : 0) + (clusterStories.length > 2 ? 8 : 0));

    clusters.push({
      id: clusterStories.map((clusterStory) => clusterStory.id).sort().join("|"),
      leadStory,
      supportingStories,
      weakDailyStarCandidate,
      importanceScore,
      importanceReasons: reasons,
      publicationCount,
      storyCount: clusterStories.length,
    });
  }

  return clusters.sort((a, b) => (
    Number(b.publicationCount >= 2) - Number(a.publicationCount >= 2) ||
    b.importanceScore - a.importanceScore ||
    b.storyCount - a.storyCount
  ));
};

const getPublicationStories = (publication: Publication): NewsDeskStory[] => {
  const sections: { key: StorySection; stories: NewsStory[] }[] = [
    { key: "frontPage", stories: publication.frontPage || [] },
    { key: "pageThree", stories: publication.pageThree || [] },
    { key: "backPage", stories: publication.backPage || [] },
  ];

  return sections.flatMap(({ key, stories }) =>
    stories.map((story, index) => ({
      id: `${publication.id}:${publication.date}:${key}:${index}:${slugify(story.title)}`,
      story,
      publicationId: publication.id,
      publicationName: publication.name,
      date: publication.date,
      edition: publication.edition,
      pageCount: publication.pageCount,
      section: key,
      sectionLabel: sectionLabels[key],
      isMainPublication: isDailyStarPublication(publication.id, publication.name),
      comparisonScore: isDailyStarPublication(publication.id, publication.name) ? 100 : 0,
      comparisonLabel: isDailyStarPublication(publication.id, publication.name) ? "Daily Star baseline" : "Not compared",
    }))
  );
};

const summaryPublications: Publication[] = [];

export default function Home() {
  // Sidebar / navigation
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedPubId, setSelectedPubId] = useState<string>(MAIN_PUBLICATION_ID);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // View mode: "desk" for cross-publication newsroom, "pages" for page viewer, "summary" for story summary
  const [viewMode, setViewMode] = useState<ViewMode>("desk");
  const [deskTab, setDeskTab] = useState<DeskTab>("missed");
  const [deskSearch, setDeskSearch] = useState("");
  const [deskDate, setDeskDate] = useState<string | null>(null);
  const [deskPublicationFilter, setDeskPublicationFilter] = useState("all");
  const [deskEditionDetails, setDeskEditionDetails] = useState<Publication[]>([]);
  const [isLoadingDeskEditions, setIsLoadingDeskEditions] = useState(false);
  const [deskLoadError, setDeskLoadError] = useState<string | null>(null);

  // Page Viewer state
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
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
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{
    distance: number;
    zoom: number;
    center: { x: number; y: number };
  } | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const clampZoom = (value: number) => Math.min(Math.max(value, 1), 5);

  const resetViewerPosition = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsPanning(false);
    activePointersRef.current.clear();
    pinchRef.current = null;
    lastPointerRef.current = null;
  }, []);

  const getViewerPoint = useCallback((clientX: number, clientY: number) => {
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2,
    };
  }, []);

  const zoomAtPoint = useCallback((clientX: number, clientY: number, nextZoomValue: number) => {
    const nextZoom = clampZoom(nextZoomValue);
    if (nextZoom <= 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsPanning(false);
      return;
    }

    const currentZoom = zoomRef.current;
    const point = getViewerPoint(clientX, clientY);
    const ratio = nextZoom / currentZoom;
    const currentPan = panRef.current;

    setZoom(nextZoom);
    setPan({
      x: point.x - (point.x - currentPan.x) * ratio,
      y: point.y - (point.y - currentPan.y) * ratio,
    });
  }, [getViewerPoint]);

  const zoomFromCenter = useCallback((nextZoomValue: number) => {
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect) {
      setZoom(clampZoom(nextZoomValue));
      return;
    }

    zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, nextZoomValue);
  }, [zoomAtPoint]);

  const getPointerDistance = (points: { x: number; y: number }[]) => {
    const [first, second] = points;
    return Math.hypot(first.x - second.x, first.y - second.y);
  };

  const getPointerCenter = (points: { x: number; y: number }[]) => {
    const [first, second] = points;
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
  };

  // Fetch uploaded publications
  const fetchPublications = useCallback(async () => {
    setIsLoadingPubs(true);
    try {
      const res = await fetch("/api/editions", { cache: "no-store" });
      const data = await res.json();
      setUploadedPubs(data.publications || []);
    } catch (err) {
      console.error("Failed to fetch publications:", err);
    } finally {
      setIsLoadingPubs(false);
    }
  }, []);

  useEffect(() => {
    fetchPublications();
  }, [fetchPublications]);

  const uploadedEditionOptions = useMemo(() => uploadedPubs.flatMap((publication) =>
    publication.editions.map((edition) => ({
      ...edition,
      publicationGroupId: publication.id,
      publicationGroupName: publication.name,
    }))
  ), [uploadedPubs]);

  const deskDateOptions = useMemo(() => {
    const sourceDates = uploadedEditionOptions.length > 0
      ? uploadedEditionOptions.map((edition) => edition.date)
      : summaryPublications.map((publication) => publication.date);
    return Array.from(new Set(sourceDates)).sort((a, b) => b.localeCompare(a));
  }, [uploadedEditionOptions]);

  const deskDateOptionsKey = deskDateOptions.join("|");

  useEffect(() => {
    if (deskDateOptions.length === 0) return;

    const dateWithDailyStar = deskDateOptions.find((date) => {
      const editionsForDate = uploadedEditionOptions.filter((edition) => edition.date === date);
      return editionsForDate.some((edition) => isDailyStarPublication(edition.publicationId, edition.publicationName)) &&
        editionsForDate.length > 1;
    });

    const selectedDateIsAvailable = selectedDate && deskDateOptions.includes(selectedDate);
    const nextDeskDate = dateWithDailyStar || (selectedDateIsAvailable ? selectedDate : null) || deskDateOptions[0];

    if (!deskDate || !deskDateOptions.includes(deskDate)) {
      setDeskDate(nextDeskDate);
    }
  }, [deskDate, deskDateOptions, deskDateOptionsKey, selectedDate, uploadedEditionOptions]);

  useEffect(() => {
    if (!deskDate) {
      setDeskEditionDetails([]);
      return;
    }

    const editionsForDate = uploadedEditionOptions.filter((edition) => edition.date === deskDate);
    if (editionsForDate.length === 0) {
      setDeskEditionDetails([]);
      setDeskLoadError(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingDeskEditions(true);
    setDeskLoadError(null);

    Promise.allSettled(
      editionsForDate.map(async (edition) => {
        const res = await fetch(`/api/editions/${encodeURIComponent(edition.publicationId)}/${encodeURIComponent(edition.date)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`${edition.publicationName} failed to load`);
        }
        const data: EditionInfo = await res.json();
        return {
          id: data.publicationId,
          name: data.publicationName,
          date: data.date,
          edition: data.edition || "Standard Edition",
          pageCount: data.pageCount || data.pages?.length || 0,
          frontPage: data.frontPage || [],
          pageThree: data.pageThree || [],
          backPage: data.backPage || [],
          ocrConfidence: data.ocrConfidence || 95,
        } satisfies Publication;
      })
    )
      .then((results) => {
        if (isCancelled) return;
        const loadedPublications = results
          .filter((result): result is PromiseFulfilledResult<Publication> => result.status === "fulfilled")
          .map((result) => result.value);

        setDeskEditionDetails(loadedPublications);
        const failedCount = results.filter((result) => result.status === "rejected").length;
        setDeskLoadError(failedCount > 0 ? `${failedCount} publication could not be loaded for comparison.` : null);
      })
      .catch((error) => {
        if (!isCancelled) {
          setDeskEditionDetails([]);
          setDeskLoadError(error instanceof Error ? error.message : "Failed to load newsroom editions.");
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingDeskEditions(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [deskDate, uploadedEditionOptions]);

  // Fetch edition pages when a publication+date is selected
  const fetchEditionPages = useCallback(async (pubId: string, date: string) => {
    setIsLoadingPages(true);
    try {
      const res = await fetch(`/api/editions/${encodeURIComponent(pubId)}/${encodeURIComponent(date)}`);
      const data = await res.json();
      if (data.pages && data.pages.length > 0) {
        setPageImages(data.pages);
        setEditionMeta(data);
        setCurrentPage(0);
        resetViewerPosition();
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
  }, [resetViewerPosition]);

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
        zoomFromCenter(zoomRef.current + 0.25);
      } else if (e.key === "-") {
        e.preventDefault();
        zoomFromCenter(zoomRef.current - 0.25);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, pageImages.length, zoomFromCenter]);

  useEffect(() => {
    resetViewerPosition();
  }, [currentPage, resetViewerPosition]);

  // Auto scroll thumbnail strip to active
  useEffect(() => {
    if (thumbnailStripRef.current) {
      const activeThumb = thumbnailStripRef.current.children[currentPage] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [currentPage]);

  const selectedPublicationGroup = uploadedPubs.find((publication) => publication.id === selectedPubId);

  const dynamicSummaryPublication: Publication | null = (editionMeta && editionMeta.frontPage && editionMeta.frontPage.length > 0)
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
      }
    : null;

  const activeSummaryPub = dynamicSummaryPublication || {
    id: selectedPubId,
    name: selectedPublicationGroup?.name || "No publication selected",
    date: selectedDate || deskDate || "",
    edition: "",
    pageCount: 0,
    frontPage: [],
    pageThree: [],
    backPage: [],
    ocrConfidence: 0,
    isDynamic: false,
  };

  const isProthomAlo = selectedPubId === "prothom-alo" || activeSummaryPub.name.toLowerCase().includes("prothom") || activeSummaryPub.name.includes("প্রথম আলো");

  const pageThreeLabel = (activeSummaryPub.pageThree && activeSummaryPub.pageThree.length > 0 && activeSummaryPub.pageThree[0].originPage)
    ? activeSummaryPub.pageThree[0].originPage
    : (isProthomAlo ? "P.02" : "P.03");

  const pageThreeTitle = (activeSummaryPub.pageThree && activeSummaryPub.pageThree.length > 0 && activeSummaryPub.pageThree[0].originPage)
    ? `Page ${activeSummaryPub.pageThree[0].originPage.replace("P.", "").replace("P", "")}`
    : (isProthomAlo ? "Page 2" : "Page 3");

  const sameDateSummaryPublications = deskDate
    ? summaryPublications.filter((publication) => publication.date === deskDate)
    : summaryPublications;

  const deskPublications = deskEditionDetails.length > 0
    ? deskEditionDetails
    : deskDate
      ? sameDateSummaryPublications
      : dynamicSummaryPublication
        ? [
            dynamicSummaryPublication,
            ...summaryPublications.filter((publication) => (
              publication.id !== dynamicSummaryPublication.id || publication.date !== dynamicSummaryPublication.date
            )),
          ]
        : summaryPublications;

  const baselineStories = deskPublications
    .filter((publication) => isDailyStarPublication(publication.id, publication.name))
    .flatMap(getPublicationStories);

  const deskStories = deskPublications
    .flatMap(getPublicationStories)
    .map((deskStory) => {
      if (deskStory.isMainPublication) return deskStory;

      if (baselineStories.length === 0) {
        return {
          ...deskStory,
          comparisonScore: 0,
          comparisonLabel: "Daily Star edition missing",
        };
      }

      const bestMatch = baselineStories.reduce<StoryMatch | null>((currentBest, baselineStory) => {
        const result = scoreStrictStoryMatch(deskStory.story, baselineStory.story);
        const score = result.confirmed ? 100 : result.score;
        if (!currentBest || score > currentBest.score) {
          return {
            story: baselineStory,
            score,
            evidence: result.evidence,
            confirmed: result.confirmed,
          };
        }
        return currentBest;
      }, null);

      const comparisonScore = bestMatch?.score || 0;
      const comparisonLabel = bestMatch?.confirmed
        ? "Confirmed Daily Star match"
        : bestMatch && bestMatch.score >= 24
          ? "Weak candidate, not enough evidence"
          : "Not in Daily Star";

      return {
        ...deskStory,
        comparisonScore,
        comparisonLabel,
        mainMatchId: bestMatch?.confirmed ? bestMatch.story.id : undefined,
        mainMatchTitle: bestMatch?.confirmed ? bestMatch.story.story.title : undefined,
      };
    });

  const deskSearchTerm = normalizeText(deskSearch);
  const filteredDeskStories = deskStories
    .filter((deskStory) => {
      const searchableText = normalizeText([
        deskStory.publicationName,
        deskStory.story.title,
        deskStory.story.subheadline || "",
        deskStory.story.category,
        deskStory.story.summary,
        deskStory.story.originPage,
        deskStory.mainMatchTitle || "",
      ].join(" "));

      return (
        (!deskSearchTerm || searchableText.includes(deskSearchTerm)) &&
        (deskPublicationFilter === "all" || deskStory.publicationId === deskPublicationFilter)
      );
    })
    .sort((a, b) => {
      return (
        Number(b.isMainPublication) - Number(a.isMainPublication) ||
        getImportanceScore(b) - getImportanceScore(a) ||
        b.comparisonScore - a.comparisonScore
      );
    });

  const groupedPublicationSections = deskPublications
    .slice()
    .sort((a, b) => Number(isDailyStarPublication(b.id, b.name)) - Number(isDailyStarPublication(a.id, a.name)))
    .filter((publication) => deskPublicationFilter === "all" || publication.id === deskPublicationFilter)
    .map((publication) => ({
      publication,
      stories: filteredDeskStories.filter((deskStory) => deskStory.publicationId === publication.id),
    }));

  const filteredNonBaselineStories = filteredDeskStories.filter((deskStory) => !deskStory.isMainPublication);
  const dailyStarClusters = buildDailyStarClusters(baselineStories, filteredNonBaselineStories);
  const missedStoryClusters = buildMissedStoryClusters(filteredNonBaselineStories, baselineStories);
  const multiPublicationMissedClusters = missedStoryClusters.filter((cluster) => cluster.publicationCount >= 2);
  const singlePublicationMissedClusters = missedStoryClusters.filter((cluster) => cluster.publicationCount === 1);
  const humanCheckClusters = missedStoryClusters.filter((cluster) => cluster.weakDailyStarCandidate);
  const confirmedMatchedStoryIds = new Set(dailyStarClusters.flatMap((cluster) => cluster.matches.map((match) => match.story.id)));
  const totalMatches = confirmedMatchedStoryIds.size;
  const dailyStarStoryCount = deskStories.filter((deskStory) => deskStory.isMainPublication).length;
  const hasDailyStarBaseline = dailyStarStoryCount > 0;

  const publicationScorecards = deskPublications.map((publication) => {
    const publicationStories = deskStories.filter((deskStory) => deskStory.publicationId === publication.id);
    const publicationMissedClusters = missedStoryClusters.filter((cluster) => cluster.leadStory.publicationId === publication.id || cluster.supportingStories.some((match) => match.story.publicationId === publication.id));
    const matchedStories = isDailyStarPublication(publication.id, publication.name)
      ? publicationStories.length
      : publicationStories.filter((deskStory) => confirmedMatchedStoryIds.has(deskStory.id)).length;

    return {
      publication,
      storyCount: publicationStories.length,
      matchedStories,
      uniqueStories: publicationMissedClusters.length,
      multiPublicationMissed: publicationMissedClusters.filter((cluster) => cluster.publicationCount >= 2).length,
      matchRate: publicationStories.length > 0 ? Math.round((matchedStories / publicationStories.length) * 100) : 0,
    };
  });

  // Check if this pub has uploaded pages
  const hasUploadedPages = pageImages.length > 0;
  // Build sidebar publication list combining uploaded and summary-only pubs
  const allPubIds = new Set<string>();
  const sidebarPubs: { id: string; name: string; hasPages: boolean; editions: EditionInfo[] }[] = [];

  for (const up of uploadedPubs) {
    const editionsForActiveDate = deskDate
      ? up.editions.filter((edition) => edition.date === deskDate)
      : up.editions;

    if (deskDate && editionsForActiveDate.length === 0) {
      continue;
    }

    allPubIds.add(up.id);
    sidebarPubs.push({
      id: up.id,
      name: up.name,
      hasPages: true,
      editions: editionsForActiveDate,
    });
  }

  for (const sp of summaryPublications) {
    if (deskDate && sp.date !== deskDate) {
      continue;
    }

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

  const handleViewerWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!pageImages.length) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? 1.16 : 0.86;
    zoomAtPoint(event.clientX, event.clientY, zoomRef.current * factor);
  };

  const handleViewerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pageImages.length) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointersRef.current.size === 1) {
      setIsPanning(zoomRef.current > 1);
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      return;
    }

    if (activePointersRef.current.size === 2) {
      const points = Array.from(activePointersRef.current.values());
      pinchRef.current = {
        distance: getPointerDistance(points),
        zoom: zoomRef.current,
        center: getPointerCenter(points),
      };
      setIsPanning(true);
    }
  };

  const handleViewerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return;

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointersRef.current.size === 2 && pinchRef.current) {
      const points = Array.from(activePointersRef.current.values());
      const distance = getPointerDistance(points);
      const center = getPointerCenter(points);
      const nextZoom = pinchRef.current.zoom * (distance / Math.max(pinchRef.current.distance, 1));
      zoomAtPoint(center.x, center.y, nextZoom);
      return;
    }

    if (activePointersRef.current.size === 1 && lastPointerRef.current && zoomRef.current > 1) {
      const deltaX = event.clientX - lastPointerRef.current.x;
      const deltaY = event.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      setPan((current) => ({ x: current.x + deltaX, y: current.y + deltaY }));
    }
  };

  const handleViewerPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    pinchRef.current = null;

    if (activePointersRef.current.size === 1) {
      const remainingPoint = Array.from(activePointersRef.current.values())[0];
      lastPointerRef.current = remainingPoint;
      setIsPanning(zoomRef.current > 1);
      return;
    }

    lastPointerRef.current = null;
    setIsPanning(false);
  };

  const handleViewerDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (zoomRef.current < 2) {
      zoomAtPoint(event.clientX, event.clientY, 2.35);
    } else {
      resetViewerPosition();
    }
  };

  const renderDeskStoryCard = (deskStory: NewsDeskStory, compact = false) => {
    return (
      <article
        key={deskStory.id}
        className={cn(
          "rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
          deskStory.isMainPublication ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-200",
          compact ? "p-4" : "p-5"
        )}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
              deskStory.isMainPublication
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-slate-50 text-slate-700 border-slate-200"
            )}>
              {deskStory.isMainPublication && <Star className="h-3 w-3 fill-amber-400 text-amber-500" />}
              {deskStory.publicationName}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {deskStory.sectionLabel} • {deskStory.story.originPage}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedStory(deskStory.story)}
            className="text-left group"
          >
            <h3 className={cn(
              "font-black text-slate-950 leading-tight tracking-tight group-hover:text-emerald-700 transition-colors",
              compact ? "text-base" : "text-lg md:text-xl"
            )}>
              {deskStory.story.title}
            </h3>
            {deskStory.story.subheadline && !compact && (
              <p className="mt-1.5 text-sm text-slate-500 italic leading-relaxed">
                {deskStory.story.subheadline}
              </p>
            )}
          </button>

          {!compact && (
            <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
              {deskStory.story.summary}
            </p>
          )}

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <GitCompare className="h-3.5 w-3.5" />
                Daily Star Compare
              </div>
              <p className="text-xs font-bold text-slate-800">
                {deskStory.isMainPublication ? "Daily Star baseline" : `${deskStory.comparisonLabel} • ${deskStory.comparisonScore}%`}
              </p>
              {deskStory.mainMatchTitle && (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                  Baseline: {deskStory.mainMatchTitle}
                </p>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Star className="h-3.5 w-3.5" />
                Editorial Weight
              </div>
              <p className="text-xs font-bold text-slate-800">
                {getImportanceScore(deskStory)} importance score
              </p>
              <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                {deskStory.section === "frontPage" ? "Front-page placement increases missed-news ranking." : "Ranked by source placement and public-interest signals."}
              </p>
            </div>
          </div>

          {deskStory.story.jumpMerged && !compact && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700">
              Jump merged from {deskStory.story.jumpMerged}
            </div>
          )}
        </div>
      </article>
    );
  };

  const renderMatchClusterCard = (cluster: DailyStarCluster) => (
    <article key={cluster.anchor.id} className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="rounded-2xl bg-emerald-50 p-4">
        <p className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
          <Star className="h-3.5 w-3.5 fill-emerald-500" />
          Daily Star Anchor
        </p>
        <button type="button" onClick={() => setSelectedStory(cluster.anchor.story)} className="text-left">
          <h3 className="text-lg font-black leading-tight text-slate-950">{cluster.anchor.story.title}</h3>
        </button>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">{cluster.anchor.story.summary}</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {cluster.matches.map((match) => (
          <button
            key={match.story.id}
            type="button"
            onClick={() => setSelectedStory(match.story.story)}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">100% Match</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {match.story.publicationName} • {match.story.story.originPage}
              </span>
            </div>
            <p className="line-clamp-2 text-sm font-black leading-snug text-slate-950">{match.story.story.title}</p>
            <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-600">
              {match.evidence.slice(0, 3).join(" • ") || "Strict headline and factual overlap confirmed."}
            </p>
          </button>
        ))}
      </div>
    </article>
  );

  const renderMissedClusterCard = (cluster: MissedStoryCluster) => (
    <article
      key={cluster.id}
      className={cn(
        "rounded-3xl border bg-white p-5 shadow-sm",
        cluster.publicationCount >= 2 ? "border-rose-200 ring-1 ring-rose-100" : "border-slate-200"
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
              cluster.publicationCount >= 2 ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {cluster.publicationCount >= 2 ? "Possible Daily Star Missed" : "Single Publication Only"}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {cluster.publicationCount} publication{cluster.publicationCount === 1 ? "" : "s"} • {cluster.storyCount} item{cluster.storyCount === 1 ? "" : "s"}
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
              {cluster.importanceScore} importance
            </span>
          </div>
          <button type="button" onClick={() => setSelectedStory(cluster.leadStory.story)} className="block text-left">
            <h3 className="text-lg font-black leading-tight tracking-tight text-slate-950 transition hover:text-rose-700 md:text-xl">
              {cluster.leadStory.story.title}
            </h3>
            {cluster.leadStory.story.subheadline && (
              <p className="mt-1.5 text-sm italic leading-relaxed text-slate-500">{cluster.leadStory.story.subheadline}</p>
            )}
          </button>
          <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{cluster.leadStory.story.summary}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {[cluster.leadStory, ...cluster.supportingStories.map((match) => match.story)].map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => setSelectedStory(story.story)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-rose-200 hover:bg-rose-50"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {story.publicationName} • {story.story.originPage}
                </p>
                <p className="mt-1 line-clamp-2 text-xs font-black leading-snug text-slate-950">{story.story.title}</p>
              </button>
            ))}
          </div>
        </div>

        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="rounded-xl bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Why it matters</p>
            <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-relaxed text-slate-700">
              {cluster.importanceReasons.map((reason) => (
                <li key={reason}>- {reason}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Daily Star result</p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-700">
              No confirmed Daily Star match found from uploaded OCR summaries for this date.
            </p>
          </div>
          {cluster.weakDailyStarCandidate && (
            <button
              type="button"
              onClick={() => setSelectedStory(cluster.weakDailyStarCandidate!.story.story)}
              className="w-full rounded-xl border border-amber-100 bg-amber-50 p-3 text-left transition hover:bg-amber-100"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Weak Daily Star candidate</p>
              <p className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">
                {cluster.weakDailyStarCandidate.story.story.title}
              </p>
              <p className="mt-2 text-xs font-semibold text-amber-800">
                {cluster.weakDailyStarCandidate.score}% overlap, not enough evidence to mark as covered.
              </p>
            </button>
          )}
        </aside>
      </div>
    </article>
  );

  return (
    <div
      id="app-root"
      className={cn(
        "flex flex-col md:flex-row w-screen bg-[#F3F4F6] text-slate-800 font-sans",
        viewMode === "summary" ? "min-h-screen md:h-screen md:overflow-hidden" : "h-screen overflow-hidden"
      )}
    >

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
                    setSelectedDate(pub.editions[0]?.date || null);
                    if (pub.editions[0]?.date) setDeskDate(pub.editions[0].date);
                    setMobileMenuOpen(false);
                    setViewMode("summary");
                    setActiveColumnTab("front");
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
                          setDeskDate(ed.date);
                          setViewMode("summary");
                          setActiveColumnTab("front");
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
      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">

        {/* Top Header Bar */}
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 font-sans tracking-tight truncate">
              {viewMode === "desk" ? "Newsroom Desk" : (editionMeta?.publicationName || activeSummaryPub.name)}
            </h2>
            {viewMode === "desk" ? (
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center bg-amber-50 text-amber-800 rounded-lg px-2.5 py-1 text-[11px] border border-amber-200 font-bold font-mono">
                  <Star className="w-3 h-3 mr-1.5 fill-amber-400 text-amber-500" />
                  Daily Star Baseline
                </div>
                <div className="flex items-center bg-slate-100 rounded-lg px-2 py-1 text-[11px] border border-slate-200">
                  <span className="font-bold text-slate-500 mr-1 uppercase font-mono">Date:</span>
                  <span className="text-slate-700 font-medium">{deskDate || "All"}</span>
                </div>
                <div className="flex items-center bg-slate-100 rounded-lg px-2 py-1 text-[11px] border border-slate-200">
                  <span className="font-bold text-slate-500 mr-1 uppercase font-mono">Stories:</span>
                  <span className="text-slate-700 font-medium">{deskStories.length}</span>
                </div>
              </div>
            ) : (editionMeta || (activeSummaryPub as any).isDynamic) && (
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
                    Editorial Summary
                  </div>
                )}
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode("desk")}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5",
                  viewMode === "desk"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desk</span>
              </button>
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
        {/* NEWSROOM DESK MODE */}
        {/* ========================================= */}
        {viewMode === "desk" && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-[linear-gradient(135deg,#f8fafc_0%,#eefdf7_45%,#fff7ed_100%)]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl">
                <div className="relative p-5 md:p-7">
                  <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,#10b981_0,transparent_32%),radial-gradient(circle_at_88%_12%,#f59e0b_0,transparent_30%)]" />
                  <div className="relative grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-end">
                    <div>
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200">
                        <ClipboardList className="h-3.5 w-3.5" />
                        Cross-Publication Newsroom
                      </div>
                      <h1 className="max-w-3xl text-2xl font-black tracking-tight md:text-4xl">
                        Find the stories The Daily Star may have missed.
                      </h1>
                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
                        Same-date editions are clustered by strict evidence, so confirmed Daily Star matches stay together and unsupported stories stay separate.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                      {[
                        { label: "Daily Star Stories", value: dailyStarStoryCount, icon: Star },
                        { label: "Confirmed Matches", value: totalMatches, icon: GitCompare },
                        { label: "Possible Missed", value: missedStoryClusters.length, icon: AlertTriangle },
                        { label: "Multi-Pub Missed", value: multiPublicationMissedClusters.length, icon: Layers },
                        { label: "Single Only", value: singlePublicationMissedClusters.length, icon: Newspaper },
                      ].map((metric) => (
                        <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                          <div className="mb-2 flex items-center justify-between text-slate-300">
                            <span className="text-[10px] font-black uppercase tracking-widest">{metric.label}</span>
                            <metric.icon className="h-4 w-4 text-emerald-300" />
                          </div>
                          <div className="font-mono text-2xl font-black text-white">{metric.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur md:p-4">
                <div className="grid gap-3 lg:grid-cols-[0.7fr_1.5fr_0.9fr]">
                  <label className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={deskDate || ""}
                      onChange={(event) => {
                        setDeskDate(event.target.value || null);
                        setDeskSearch("");
                        setDeskPublicationFilter("all");
                      }}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 focus:bg-white"
                    >
                      {deskDateOptions.map((date) => (
                        <option key={date} value={date}>{date}</option>
                      ))}
                    </select>
                  </label>
                  <label className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={deskSearch}
                      onChange={(event) => setDeskSearch(event.target.value)}
                      placeholder="Search Bangla/English title, category, summary, page..."
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white"
                    />
                  </label>
                  <label className="relative">
                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={deskPublicationFilter}
                      onChange={(event) => setDeskPublicationFilter(event.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 focus:bg-white"
                    >
                      <option value="all">All publications</option>
                      {deskPublications.map((publication) => (
                        <option key={`${publication.id}-${publication.date}`} value={publication.id}>
                          {publication.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {(isLoadingDeskEditions || deskLoadError || !hasDailyStarBaseline) && (
                  <div className={cn(
                    "mt-3 rounded-2xl border px-4 py-3 text-xs font-bold",
                    isLoadingDeskEditions
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : !hasDailyStarBaseline
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                  )}>
                    {isLoadingDeskEditions
                      ? "Loading same-date OCR editions for comparison..."
                      : !hasDailyStarBaseline
                        ? "The Daily Star edition is not available for this date, so every important story is treated as a possible baseline gap."
                        : deskLoadError}
                  </div>
                )}

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {deskTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDeskTab(tab.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-wider transition",
                        deskTab === tab.id
                          ? "bg-slate-950 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </section>

              {deskTab === "missed" && (
                <section className="space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-slate-950">Possible Daily Star Missed</h2>
                      <p className="text-sm text-slate-500">Ranked clusters from other publications with no confirmed Daily Star match.</p>
                    </div>
                    <span className="w-fit rounded-full bg-rose-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-rose-700">
                      {missedStoryClusters.length} candidate{missedStoryClusters.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {missedStoryClusters.length > 0 ? (
                    <div className="space-y-4">
                      {missedStoryClusters.map(renderMissedClusterCard)}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                      <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
                      <h3 className="font-black text-emerald-950">No missed Daily Star candidate for this filter</h3>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        Strict same-date evidence did not find unsupported stories outside Daily Star.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {deskTab === "matched" && (
                <section className="space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-slate-950">Daily Star Matched</h2>
                      <p className="text-sm text-slate-500">Only confirmed same-story matches are grouped under the Daily Star headline.</p>
                    </div>
                    <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700">
                      {dailyStarClusters.length} cluster{dailyStarClusters.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {dailyStarClusters.length > 0 ? (
                    <div className="space-y-4">
                      {dailyStarClusters.map(renderMatchClusterCard)}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                      <Search className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                      <h3 className="font-black text-slate-900">No confirmed Daily Star matches</h3>
                      <p className="mt-1 text-sm text-slate-500">Upload same-date Daily Star and other editions, or widen the publication filter.</p>
                    </div>
                  )}
                </section>
              )}

              {deskTab === "human_check" && (
                <section className="space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-slate-950">Needs Human Check</h2>
                      <p className="text-sm text-slate-500">Weak Daily Star candidates stay here because evidence is not strong enough to call them covered.</p>
                    </div>
                    <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-700">
                      {humanCheckClusters.length} weak candidate{humanCheckClusters.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {humanCheckClusters.length > 0 ? (
                    <div className="space-y-4">
                      {humanCheckClusters.map(renderMissedClusterCard)}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                      <Search className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                      <h3 className="font-black text-slate-900">No weak Daily Star candidates</h3>
                      <p className="mt-1 text-sm text-slate-500">Current evidence is either confirmed matched or clearly missing.</p>
                    </div>
                  )}
                </section>
              )}

              {deskTab === "single" && (
                <section className="space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-slate-950">Single Publication Only</h2>
                      <p className="text-sm text-slate-500">Items that appear in only one non-Daily-Star publication are kept separate from bigger missed-news candidates.</p>
                    </div>
                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-600">
                      {singlePublicationMissedClusters.length} item{singlePublicationMissedClusters.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {singlePublicationMissedClusters.length > 0 ? (
                    <div className="space-y-4">
                      {singlePublicationMissedClusters.map(renderMissedClusterCard)}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                      <Search className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                      <h3 className="font-black text-slate-900">No single-publication items</h3>
                      <p className="mt-1 text-sm text-slate-500">Every visible non-Daily-Star item is either matched or supported by another source.</p>
                    </div>
                  )}
                </section>
              )}

              {deskTab === "all" && (
                <section className="space-y-4">
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-slate-950">Publication Comparison Matrix</h2>
                    <p className="text-sm text-slate-500">Daily Star is treated as the baseline; other publications show confirmed matches and unmatched items.</p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {publicationScorecards.map((scorecard) => (
                      <div
                        key={`${scorecard.publication.id}-${scorecard.publication.date}`}
                        className={cn(
                          "rounded-3xl border bg-white p-5 shadow-sm",
                          scorecard.publication.id === MAIN_PUBLICATION_ID ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-200"
                        )}
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{scorecard.publication.date}</p>
                            <h3 className="mt-1 text-lg font-black leading-tight text-slate-950">{scorecard.publication.name}</h3>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{scorecard.publication.edition}</p>
                          </div>
                          {scorecard.publication.id === MAIN_PUBLICATION_ID && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                              Baseline
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stories</p>
                            <p className="mt-1 font-mono text-2xl font-black text-slate-950">{scorecard.storyCount}</p>
                          </div>
                          <div className="rounded-2xl bg-emerald-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Match Rate</p>
                            <p className="mt-1 font-mono text-2xl font-black text-emerald-900">{scorecard.matchRate}%</p>
                          </div>
                          <div className="rounded-2xl bg-amber-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Multi-Pub Missed</p>
                            <p className="mt-1 font-mono text-2xl font-black text-amber-900">{scorecard.multiPublicationMissed}</p>
                          </div>
                          <div className="rounded-2xl bg-rose-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Unique</p>
                            <p className="mt-1 font-mono text-2xl font-black text-rose-900">{scorecard.uniqueStories}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

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
                <div
                  ref={viewerRef}
                  className={cn(
                    "flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_center,#172033_0%,#0B1120_68%)] select-none touch-none",
                    zoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
                  )}
                  onWheel={handleViewerWheel}
                  onPointerDown={handleViewerPointerDown}
                  onPointerMove={handleViewerPointerMove}
                  onPointerUp={handleViewerPointerUp}
                  onPointerCancel={handleViewerPointerUp}
                  onDoubleClick={handleViewerDoubleClick}
                >
                  {/* Navigation Arrows */}
                  <button
                    className="page-nav-btn prev"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    className="page-nav-btn next"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageImages.length - 1))}
                    disabled={currentPage === pageImages.length - 1}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>

                  {/* Page Image */}
                  <div className="w-full h-full overflow-hidden flex items-center justify-center p-3 md:p-5">
                    <AnimatePresence mode="wait">
                      <div
                        key={currentPage}
                        className="relative flex h-full w-full items-center justify-center"
                        style={{
                          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                          transformOrigin: "center center",
                          transition: isPanning ? "none" : "transform 160ms ease",
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
                            maxHeight: "100%",
                            objectFit: "contain",
                          }}
                          className="max-h-full rounded shadow-2xl pointer-events-none"
                          draggable={false}
                        />
                      </div>
                    </AnimatePresence>
                  </div>

                  {/* Zoom Controls */}
                  <div className="zoom-controls" onPointerDown={(event) => event.stopPropagation()}>
                    <button
                      className="zoom-btn"
                      onClick={() => zoomFromCenter(zoomRef.current - 0.25)}
                      title="Zoom out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="zoom-btn text-xs font-mono text-slate-400 cursor-default">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      className="zoom-btn"
                      onClick={() => zoomFromCenter(zoomRef.current + 0.25)}
                      title="Zoom in"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      className="zoom-btn hidden sm:flex"
                      onClick={() => zoomFromCenter(2.25)}
                      title="Reading zoom"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                    <button className="zoom-btn" onClick={resetViewerPosition} title="Fit page">
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
            <div className="xl:hidden sticky top-0 z-10 px-4 md:px-6 pt-4 pb-2 bg-[#F8FAFC] flex-shrink-0">
              <div className="flex bg-slate-200/60 p-1.5 rounded-2xl border border-slate-200/80 gap-1 shadow-2xs">
                <button
                  onClick={() => setActiveColumnTab("front")}
                  className={cn(
                    "flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase rounded-xl transition-all duration-200 cursor-pointer text-center",
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
                    "flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase rounded-xl transition-all duration-200 cursor-pointer text-center",
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
                    "flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase rounded-xl transition-all duration-200 cursor-pointer text-center",
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
            <div className="flex-1 flex flex-col xl:flex-row gap-4 md:gap-6 p-4 md:p-6 overflow-visible md:overflow-y-auto xl:overflow-hidden bg-[#F8FAFC]">

              {/* Column: Front Page */}
              <section className={cn(
                "flex flex-col min-w-0 min-h-0 xl:flex-1 bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-xs transition-all",
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
                <div className="xl:flex-1 xl:overflow-y-auto pr-1 space-y-4">
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
                      <p className="text-sm text-slate-600 leading-relaxed md:line-clamp-3 mb-2">{story.summary}</p>
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
                "flex flex-col min-w-0 min-h-0 xl:flex-1 bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-xs transition-all",
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
                <div className="xl:flex-1 xl:overflow-y-auto pr-1 space-y-4">
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
                      <p className="text-sm text-slate-600 leading-relaxed md:line-clamp-3 mb-2">{story.summary}</p>
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
                "flex flex-col min-w-0 min-h-0 xl:flex-1 bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-xs transition-all",
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
                <div className="xl:flex-1 xl:overflow-y-auto pr-1 space-y-4">
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
                      <p className="text-sm text-slate-600 leading-relaxed md:line-clamp-3 mb-2">{story.summary}</p>
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
