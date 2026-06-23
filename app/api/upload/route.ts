import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { syncLocalEditionToSupabase, uploadPageToSupabaseStorage } from "@/lib/editorpulse-backend";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const DEFAULT_GEMINI_OCR_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_JUMP_MODEL = "gemini-2.5-pro";

// Lazy-loaded Gemini client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function getGeminiModel(task: "ocr" | "jump") {
  const configuredModel =
    task === "jump" ? process.env.GEMINI_JUMP_MODEL : process.env.GEMINI_OCR_MODEL;

  return configuredModel?.trim() || (
    task === "jump" ? DEFAULT_GEMINI_JUMP_MODEL : DEFAULT_GEMINI_OCR_MODEL
  );
}

function fileToBase64(filePath: string): { base64: string; mimeType: string } {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  let mimeType = "image/png";
  if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
  if (ext === ".webp") mimeType = "image/webp";
  return {
    base64: buffer.toString("base64"),
    mimeType
  };
}

async function pageSourceToBase64(pageSource: string): Promise<{ base64: string; mimeType: string }> {
  if (/^https?:\/\//i.test(pageSource)) {
    const response = await fetch(pageSource);
    if (!response.ok) {
      throw new Error(`Could not read uploaded page (${response.status})`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      base64: buffer.toString("base64"),
      mimeType: response.headers.get("content-type")?.split(";")[0] || "image/png",
    };
  }

  return fileToBase64(path.join(process.cwd(), "public", pageSource));
}

function getPublicationOutputLanguage(pubId: string, publicationName: string) {
  const normalizedPubId = pubId.toLowerCase();
  const normalizedName = publicationName.toLowerCase();

  if (normalizedPubId === "daily-star" || normalizedName.includes("daily star")) {
    return "English";
  }

  return "Bangla";
}

function getLanguageLockInstruction(outputLanguage: string) {
  if (outputLanguage === "English") {
    return `LANGUAGE LOCK:
- Output every reader-facing field in natural newsroom English only: title, subheadline, byline, author, category, summary, and jumpDetails.
- Do not translate Daily Star stories into Bangla.
- Keep names, quoted terms, institutions, and numbers faithful to the printed article.`;
  }

  return `LANGUAGE LOCK:
- Output every reader-facing field in natural Bangla script only: title, subheadline, byline, author, category, summary, and jumpDetails.
- Do not write summaries in English and do not use romanized Bangla.
- Keep names, quoted terms, institutions, and numbers faithful to the printed article.`;
}

export function parseOcrPages(input: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const parts = input.split(",").map(p => p.trim().toLowerCase());
  
  parts.forEach(part => {
    if (!part) {
      return;
    }

    if (part === "all") {
      for (let index = 0; index < totalPages; index++) {
        pages.add(index);
      }
      return;
    }

    if (part === "last") {
      if (totalPages > 0) pages.add(totalPages - 1);
      return;
    }

    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let pageNumber = min; pageNumber <= max; pageNumber++) {
        if (pageNumber >= 1 && totalPages > 0) {
          pages.add(Math.min(pageNumber - 1, totalPages - 1));
        }
      }
      return;
    }

    const num = parseInt(part);
    if (!isNaN(num)) {
      if (num >= 1) {
        const index = num - 1;
        if (index < totalPages) {
          pages.add(index);
        } else if (totalPages > 0) {
          // Clamp to last page if page number exceeds total page count.
          pages.add(totalPages - 1);
        }
      }
    }
  });

  return Array.from(pages).sort((a, b) => a - b);
}

async function mergeStoryJump(
  pubId: string,
  publicationName: string,
  date: string,
  story: any,
  jumpPageNumber: number,
  savedPages: string[],
  pageSources: string[]
) {
  const jumpIndex = jumpPageNumber - 1;
  if (jumpIndex < 0 || jumpIndex >= savedPages.length) {
    console.warn(`Jump page ${jumpPageNumber} is out of bounds (1-${savedPages.length})`);
    return;
  }

  console.log(`[Jump Resolution] Resolving jump for story "${story.title}" to Page ${jumpPageNumber}`);
  const { base64, mimeType } = await pageSourceToBase64(pageSources[jumpIndex] || savedPages[jumpIndex]);
  const outputLanguage = getPublicationOutputLanguage(pubId, publicationName);
  const languageLockInstruction = getLanguageLockInstruction(outputLanguage);
  
  const jumpPrompt = `You are a meticulous newspaper continuation editor. Accuracy is more important than completeness.
We are analyzing a newspaper edition for "${publicationName}" on "${date}".
The required output language is: ${outputLanguage}.
${languageLockInstruction}

Here is the beginning of a news story from Page ${story.originPage}:
Title: "${story.title}"
Subheadline: "${story.subheadline || ''}"
Initial Summary: "${story.summary}"

This story continues on Page ${jumpPageNumber}.
I have uploaded the image of Page ${jumpPageNumber}.
Please:
1. Locate only the continuation segment of this exact story on the page image.
2. Confirm the match using headline words, names, places, topic, continuation marker, column context, or repeated lead facts.
3. If the page does not clearly contain this story's continuation, set "matched" to false and do not invent or merge unrelated material.
4. If matched, read the continuation text and extract all detailed facts, statistics, statements, and conclusions.
5. Seamlessly merge the continuation content with the "Initial Summary" into a single, cohesive, highly detailed, editorial-grade narrative summary (at least 5 to 7 sentences, 150-250 words) that reads naturally and completely in ${outputLanguage}.
6. The merged summary must carry the full story's main theme, key actors, causes, chronology, numbers/statistics, official responses, consequences, and conclusion. Do not merely append the continuation text; rewrite it as one complete newsroom digest.
7. Keep "summary" and "jumpDetails" in ${outputLanguage}. For Bangla output, use Bangla script only.
8. Output your response as a JSON object matching this schema:
{
  "matched": true,
  "confidence": 0.95,
  "summary": "The consolidated complete summary text here",
  "jumpDetails": "A brief trace explaining the exact match evidence and what details were merged from Page ${jumpPageNumber}."
}
Do not include markdown formatting or backticks outside of the JSON block itself. Do not guess.`;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: getGeminiModel("jump"),
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64
          }
        },
        { text: jumpPrompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["matched", "confidence", "summary", "jumpDetails"],
          properties: {
            matched: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            jumpDetails: { type: Type.STRING }
          }
        }
      }
    });

    const textOutput = response.text;
    if (textOutput) {
      const parsed = JSON.parse(textOutput);
      if (!parsed.matched || Number(parsed.confidence || 0) < 0.82) {
        story.hasJump = false;
        story.jumpDetails = `Continuation on Page ${jumpPageNumber} was not merged because the match was not confident enough.`;
        return;
      }
      story.summary = parsed.summary;
      story.jumpDetails = parsed.jumpDetails;
      story.jumpMerged = `P.${String(jumpPageNumber).padStart(2, "0")}`;
    }
  } catch (error) {
    console.error(`Failed to resolve jump for story "${story.title}" on Page ${jumpPageNumber}:`, error);
  }
}

export async function runGeminiOCR(
  pubId: string,
  publicationName: string,
  date: string,
  edition: string,
  savedPages: string[],
  editionDir: string,
  ocrPagesInput: string,
  pageSources: string[] = savedPages
) {
  const summaryPath = path.join(editionDir, "summary.json");
  
  // Rule mapping
  const isProthomAlo = pubId === "prothom-alo" || publicationName.toLowerCase().includes("prothom") || publicationName.includes("প্রথম আলো");
  const isDailyStar = pubId === "daily-star" || publicationName.toLowerCase().includes("daily star");
  const isSamakal = pubId === "samakal" || publicationName.toLowerCase().includes("samakal") || publicationName.includes("সমকাল");
  const outputLanguage = getPublicationOutputLanguage(pubId, publicationName);
  const languageLockInstruction = getLanguageLockInstruction(outputLanguage);

  const ocrIndices = parseOcrPages(ocrPagesInput, savedPages.length);
  if (ocrIndices.length === 0) {
    throw new Error("No valid OCR pages were selected. Use page numbers like 1, 2, 3, last.");
  }

  const pageNumbers = ocrIndices.map(idx => idx + 1);
  const firstPage = pageNumbers[0] || 1;
  const lastPage = pageNumbers[pageNumbers.length - 1] || savedPages.length;
  const middlePages = pageNumbers.slice(1, -1);

  let categorizationInstructions = `Please categorize the final extracted stories as follows:
- frontPage: Stories starting on Page ${firstPage}.
- backPage: Stories starting on Page ${lastPage}.`;

  if (middlePages.length > 0) {
    categorizationInstructions += `\n- pageThree: Stories starting on pages: ${middlePages.join(", ")}.`;
  } else {
    categorizationInstructions += `\n- pageThree: Leave this array empty since no intermediate pages were selected.`;
  }

  const prompt = `You are a prestigious Chief Newspaper Editor and lead curator. Your task is to analyze these ${ocrIndices.length} uploaded newspaper page images, identify their news stories, and compile them into extremely high-fidelity, deep, and cohesive articles.
Your publication is: "${publicationName}". Date is: "${date}".
The required output language is: ${outputLanguage}.
${languageLockInstruction}

We want to focus on extracting the main news stories starting on specific pages:
- Target news source pages: ${ocrPagesInput} (mapped to pages: ${pageNumbers.join(", ")}).

For each news story on the targeted pages, please extract and synthesize:
- title: A powerful, high-impact main headline in ${outputLanguage}.
- subheadline: A beautifully descriptive secondary summary tagline context line in ${outputLanguage}.
- byline: Reporting location/desk in ${outputLanguage} (e.g. "DHAKA", "Sports Desk", "Staff Reporter" for English; "ঢাকা", "ক্রীড়া প্রতিবেদক", "নিজস্ব প্রতিবেদক" for Bangla).
- author: The dedicated writer/reporter's name if explicitly listed; otherwise use the natural ${outputLanguage} equivalent of "Reporter".
- category: A concise newsroom category in ${outputLanguage}.
- summary: A highly detailed, editorial-grade narrative summary in ${outputLanguage} (at least 3 to 5 substantial sentences, 100-150 words) structured as a complete news capsule. Do NOT write brief, generic, or truncated summaries. You must fully explain the story's main theme, context, key individuals, organizations, numbers/statistics, chronology, official responses, consequences, and conclusion.
- originPage: The source page of the lead story (e.g. "P.01", "P.02", "P.16").
- hasJump: Set to true only if the story text clearly contains a continuation marker or page jump instruction (e.g., "৪-এর পাতায় দেখুন", "বাকি অংশ পৃষ্ঠা ৪", "Continued on Page 4"). Do not infer a jump only because an article feels incomplete.
- jumpPageNumber: The target page number where the story continues (1-based integer, e.g. 4. If hasJump is false, write null or omit).

Jump/continuation accuracy rules:
- Detect the exact printed continuation marker and target page number where possible.
- Never merge a continuation unless the later page clearly matches the same story by headline/topic/names/places/lead facts.
- Keep unrelated stories separate even if they share a broad topic.
- If the target page number is unclear, set hasJump to false rather than guessing.
- When a continuation is found, the final merged story must remain in ${outputLanguage} and must read like one complete article digest, not a short preview.
- The summary must preserve the full news theme and all important continuation facts so an editor can understand the whole story without opening the page.

Please categorize the final extracted stories as follows:
${categorizationInstructions}

Ensure the resulting summaries act as an authoritative and complete digest allowing any reader to fully understand the entire issue without requiring external context. Output conforming strictly to the requested JSON schema. Do not include markdown formatting or backticks outside of the JSON block itself.`;

  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not set. Generating mock summaries for development.");
    
    // Generate simulated summaries matching configuration
    const simulatedData = {
      publicationName,
      date,
      edition,
      frontPage: [
        {
          title: isSamakal
            ? "তৈরি পোশাক খাতে মজুরি বোর্ড গঠনের দাবি শ্রমিকদের"
            : isProthomAlo
            ? "মুদ্রাস্ফীতি নিয়ন্ত্রণে কঠোর পদক্ষেপের নির্দেশ প্রধানমন্ত্রীর"
            : "Inflationary pressures reshape national budget outlook and fiscal allocations",
          subheadline: isSamakal
            ? "মূল্যস্ফীতির সঙ্গে সামঞ্জস্য রেখে ন্যূনতম মজুরি ২৫ হাজার টাকা নির্ধারণের দাবি"
            : isProthomAlo
            ? "চালের ওপর আমদানি শুল্ক প্রত্যাহার, মজুতদারদের বিরুদ্ধে আজ থেকেই মোবাইল কোর্টের নির্দেশ"
            : "Finance ministry braces for strict structural guidelines to stabilize reserves",
          byline: isDailyStar ? "Dhaka, Bangladesh" : "ঢাকা",
          author: isSamakal ? "আলামিন হোসেন" : isProthomAlo ? "শেখ সাবিহা ইয়াসমিন" : "Refayet Ullah Mirdha",
          category: isDailyStar ? "Lead News" : "জাতীয়",
          summary: isSamakal
            ? "তৈরি পোশাক খাতের শ্রমিকরা নতুন মজুরি বোর্ড গঠনের দাবি জানিয়েছেন। জীবনযাত্রার ব্যয় বৃদ্ধি ও লাগামহীন মূল্যস্ফীতির কারণে ন্যূনতম মজুরি ২৫ হাজার টাকা করার জোর দাবি জানানো হয়। পৃষ্ঠা ৪-এর বিস্তারিত অনুযায়ী, বিভিন্ন শ্রমিক সংগঠনের প্রতিনিধিরা আজ সকালে জাতীয় প্রেসক্লাবের সামনে আয়োজিত মানববন্ধন ও সমাবেশ থেকে এই আল্টিমেটাম দেন।"
            : isProthomAlo
            ? "প্রধানমন্ত্রীর নির্দেশনায় চাল ও অন্যান্য নিত্যপ্রয়োজনীয় পণ্য আমদানির ক্ষেত্রে শুল্ক ছাড় দেওয়ার ঘোষণা দেওয়া হয়েছে। বাজারে কৃত্রিম সংকট সৃষ্টিকারী মজুতদারদের বিরুদ্ধে আজ থেকেই মোবাইল কোর্ট পরিচালনার নির্দেশ দেওয়া হয়েছে। পৃষ্ঠা ৪-এর বিবরণ অনুযায়ী, খাদ্য মন্ত্রণালয় বিশেষ মনিটরিং সেল গঠন করেছে এবং কোনো অনিয়ম পেলে তাৎক্ষণিক আইনগত ব্যবস্থা নেওয়ার নির্দেশ দিয়েছে।"
            : "Unified Editorial Summary (Consolidating the Front Page Lead with Page P.04 continuation details): Our editorial team has synthesized the raw front-page text with the continuation segment found on page P.04. Central administrators have announced strict regulatory measures over reserves to stabilize pricing models.",
          originPage: `P.${String(firstPage).padStart(2, "0")}`,
          hasJump: true,
          jumpPageNumber: 4,
          jumpMerged: "P.04",
          jumpDetails: isSamakal
            ? "জাম্প নিউজ ট্র্যাকিং: পৃষ্ঠা ৪ কলাম ৫-এর পোশাক শ্রমিকদের আন্দোলনের গতিবিধি ও দাবিদাওয়া একত্রিত করা হয়েছে।"
            : isProthomAlo
            ? "জাম্প নিউজ ট্র্যাকিং: পৃষ্ঠা ৪ কলাম ২-এ বিস্তারিত দেখুন। মনিটরিং সেল ও মোবাইল কোর্টের সাজার বিবরণ একত্রিত করা হয়েছে।"
            : "Jump news trace consolidated cleanly. Merged lead report from Page 1 with secondary columns on Page 4."
        }
      ],
      pageThree: middlePages.length > 0 ? [
        {
          title: isSamakal
            ? "ঢাকা ওয়াসা পানির দাম বাড়ানোর প্রস্তাব নাকচ করলো মন্ত্রণালয়"
            : isProthomAlo
            ? "রাজধানীর বায়ুমান নিয়ন্ত্রণে বিশেষ টাস্কফোর্স গঠন"
            : "Dhaka air standard deteriorates under dust control failures",
          subheadline: isSamakal
            ? "চাহিদা অনুযায়ী সেবা নিশ্চিত না করে অতিরিক্ত বোঝা চাপানো যাবে না"
            : isProthomAlo
            ? "নির্মাণাধীন প্রকল্পগুলোতে প্রতিদিন পানি ছিটানো বাধ্যতামূলক"
            : "Environment enforcement units planning snap compliance inspections on capital construction sites",
          byline: isDailyStar ? "Metro Desk" : "ঢাকা",
          author: isSamakal ? "তানভীর আহমেদ" : isProthomAlo ? "নিজস্ব প্রতিবেদক" : "Mohammad Al-Masum Molla",
          category: isDailyStar ? "National" : "নগর উন্নয়ন",
          summary: isSamakal
            ? "রাজধানীর গ্রাহকদের সুষ্ঠু পানি সরবরাহ নিশ্চিত না করে পানির দাম বাড়ানোর প্রস্তাব নাকচ করেছে স্থানীয় সরকার মন্ত্রণালয়। ওয়াসার পক্ষ থেকে দাবি করা হয়েছিল পরিচালন ব্যয় বেড়ে যাওয়ায় এ মূল্যবৃদ্ধি জরুরি, কিন্তু মন্ত্রণালয় জানায় সেবার মান উন্নত না করে অতিরিক্ত করের বোঝা চাপানো যাবে না।"
            : isProthomAlo
            ? "রাজধানীর ধুলোবালি ও দূষণ নিয়ন্ত্রণে একটি বিশেষ টাস্কফোর্স গঠন করেছে পরিবেশ অধিদপ্তর। মেগাপ্রজেক্ট ও অন্যান্য নির্মাণাধীন সাইটগুলোতে দিনে অন্তত দুবার পানি ছিটানো বাধ্যতামূলক করা হয়েছে। লঙ্ঘনকারীদের বিরুদ্ধে ভারী জরিমানার বিধান রাখা হয়েছে।"
            : "Air quality indicators across major metropolitan zones have deteriorated significantly ahead of the upcoming dry season. The local environmental agency has traced dust-suppression failures in active construction sites.",
          originPage: `P.${String(middlePages[0]).padStart(2, "0")}`,
          hasJump: false,
        }
      ] : [],
      backPage: [
        {
          title: isSamakal
            ? "খেলাধুলা: বড় জয়ে সেমিফাইনালের পথে বাংলাদেশ অনূর্ধ্ব-১৯ দল"
            : isProthomAlo
            ? "বাংলাদেশ ক্রিকেট দলের নিবিড় অনুশীলন ক্যাম্প শুরু"
            : "National Cricket Academy announces intensive preparation schedule ahead of international fixtures",
          subheadline: isSamakal
            ? "ব্যাট-বলে অলরাউন্ড পারফরম্যান্সে দুর্দান্ত খেলে ভারতকে উড়িয়ে দিল যুবারা"
            : isProthomAlo
            ? "পেসারদের জন্য বিশেষ ফিটনেস মডিউল তৈরি"
            : "Top fast-bowlers placed under special endurance modules with state therapists",
          byline: isDailyStar ? "Sports Correspondent" : "ক্রীড়া প্রতিবেদক",
          author: isSamakal ? "সৈয়দ ফয়েজ আহমেদ" : isProthomAlo ? "মাসুদ আলম" : "Mazhar Uddin",
          category: "Sports",
          summary: isSamakal
            ? "যুব এশিয়া কাপ ক্রিকেটে ভারতকে বড় ব্যবধানে পরাজিত করে সেমিফাইনালের পথে এক ধাপ এগিয়ে গেল টিম বাংলাদেশ। টসে জিতে প্রথমে ব্যাটিং করে বাংলাদেশ নির্ধারিত ৫০ ওভারে ২৮৫ রান সংগ্রহ করে। পরে বোলিংয়ে দুর্দান্ত পারফর্ম করে ভারতের যুবাদের মাত্র ১৮০ রানে অলআউট করে দেয়।"
            : isProthomAlo
            ? "আসন্ন আন্তর্জাতিক সিরিজগুলোর প্রস্তুতি হিসেবে শেরেবাংলা স্টেডিয়ামে অনুশীলন ক্যাম্প শুরু করেছে জাতীয় দল। বিশেষ করে ফাস্ট বোলারদের জন্য ইনজুরি প্রতিরোধে ফিজিওর অধীনে বিশেষ ট্র্যাকিং সেশন তৈরি করা হয়েছে।"
            : "The National Cricket Academy has officially launched an intensive high-performance preparation camp in Dhaka to prepare the national squad for upcoming international tours.",
          originPage: `P.${String(lastPage).padStart(2, "0")}`,
          hasJump: false,
        }
      ]
    };
    fs.writeFileSync(summaryPath, JSON.stringify(simulatedData, null, 2));
    return;
  }

  try {
    const ai = getGeminiClient();
    const parts: any[] = [];

    // Load only the selected OCR pages
    ocrIndices.forEach((idx) => {
      const source = pageSources[idx] || savedPages[idx];
      parts.push(pageSourceToBase64(source).then(({ base64, mimeType }) => ({
        inlineData: {
          mimeType,
          data: base64
        }
      })));
    });

    const resolvedParts = await Promise.all(parts);

    resolvedParts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: getGeminiModel("ocr"),
      contents: resolvedParts,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["publicationName", "date", "edition", "frontPage", "pageThree", "backPage"],
          properties: {
            publicationName: { type: Type.STRING },
            date: { type: Type.STRING },
            edition: { type: Type.STRING },
            frontPage: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["title", "category", "summary", "originPage", "hasJump"],
                properties: {
                  title: { type: Type.STRING },
                  subheadline: { type: Type.STRING },
                  byline: { type: Type.STRING },
                  author: { type: Type.STRING },
                  category: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  originPage: { type: Type.STRING },
                  hasJump: { type: Type.BOOLEAN },
                  jumpPageNumber: { type: Type.INTEGER }
                }
              }
            },
            pageThree: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["title", "category", "summary", "originPage", "hasJump"],
                properties: {
                  title: { type: Type.STRING },
                  subheadline: { type: Type.STRING },
                  byline: { type: Type.STRING },
                  author: { type: Type.STRING },
                  category: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  originPage: { type: Type.STRING },
                  hasJump: { type: Type.BOOLEAN },
                  jumpPageNumber: { type: Type.INTEGER }
                }
              }
            },
            backPage: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["title", "category", "summary", "originPage", "hasJump"],
                properties: {
                  title: { type: Type.STRING },
                  subheadline: { type: Type.STRING },
                  byline: { type: Type.STRING },
                  author: { type: Type.STRING },
                  category: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  originPage: { type: Type.STRING },
                  hasJump: { type: Type.BOOLEAN },
                  jumpPageNumber: { type: Type.INTEGER }
                }
              }
            }
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedData = JSON.parse(textOutput);

    // 2-Step OCR Process: Resolve Jumps dynamically
    console.log("Checking for story jumps...");
    for (const story of parsedData.frontPage || []) {
      if (story.hasJump && story.jumpPageNumber) {
        await mergeStoryJump(pubId, publicationName, date, story, story.jumpPageNumber, savedPages, pageSources);
      }
    }
    for (const story of parsedData.pageThree || []) {
      if (story.hasJump && story.jumpPageNumber) {
        await mergeStoryJump(pubId, publicationName, date, story, story.jumpPageNumber, savedPages, pageSources);
      }
    }
    for (const story of parsedData.backPage || []) {
      if (story.hasJump && story.jumpPageNumber) {
        await mergeStoryJump(pubId, publicationName, date, story, story.jumpPageNumber, savedPages, pageSources);
      }
    }

    fs.writeFileSync(summaryPath, JSON.stringify(parsedData, null, 2));
    console.log(`Saved dynamic summary.json for ${pubId} on ${date}`);

  } catch (error) {
    console.error("Failed running Gemini OCR on uploaded pages:", error);
    // Write fallback structure
    const fallback = {
      publicationName,
      date,
      edition,
      frontPage: [],
      pageThree: [],
      backPage: [],
      error: error instanceof Error ? error.message : String(error)
    };
    fs.writeFileSync(summaryPath, JSON.stringify(fallback, null, 2));
  }
}


function sanitizeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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

  // Remove existing edition with same date (overwrite)
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

    const formData = await req.formData();

    const publicationName = formData.get("publicationName") as string;
    const date = formData.get("date") as string;
    const edition = (formData.get("edition") as string) || "Standard Edition";
    const pubIdInput = formData.get("publicationId") as string;

    if (!publicationName || !date) {
      return NextResponse.json(
        { error: "publicationName and date are required" },
        { status: 400 }
      );
    }

    const pubId = pubIdInput || sanitizeId(publicationName);
    const dateFormatted = date; // Expect YYYY-MM-DD format
    const pagesJson = formData.get("pages") as string | null;
    const stagedPages = pagesJson ? JSON.parse(pagesJson) as string[] : [];

    // Collect files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "files" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0 && stagedPages.length === 0) {
      return NextResponse.json(
        { error: "At least one uploaded page is required" },
        { status: 400 }
      );
    }

    const usesStagedStorage = stagedPages.length > 0;
    const editionDir = usesStagedStorage
      ? path.join(os.tmpdir(), "editorpulse", pubId, dateFormatted)
      : path.join(UPLOADS_DIR, pubId, dateFormatted);
    fs.mkdirSync(editionDir, { recursive: true });

    const savedPages: string[] = [...stagedPages];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop() || "png";
      const fileName = `page-${(i + 1).toString().padStart(2, "0")}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const objectPath = `${pubId}/${dateFormatted}/${fileName}`;
      const pageUrl = await uploadPageToSupabaseStorage({
        objectPath,
        buffer,
        contentType: file.type || "application/octet-stream",
      });
      savedPages.push(pageUrl);
    }

    if (!usesStagedStorage && files.length > 0 && !process.env.VERCEL) {
      updateManifest(pubId, publicationName, {
        date: dateFormatted,
        edition,
        pageCount: files.length,
        pages: savedPages,
      });
    }

    const ocrPages = (formData.get("ocrPages") as string) || "1, 2, 17";

    // Run Gemini OCR news summary generation
    await runGeminiOCR(pubId, publicationName, dateFormatted, edition, savedPages, editionDir, ocrPages);
    try {
      await syncLocalEditionToSupabase({
        publicationId: pubId,
        publicationName,
        date: dateFormatted,
        edition,
        pages: savedPages,
        editionDir,
      });
    } catch (syncError) {
      console.error("Supabase sync failed after upload:", syncError);
    }

    return NextResponse.json({
      success: true,
      publicationId: pubId,
      publicationName,
      date: dateFormatted,
      edition,
      pageCount: savedPages.length,
      pages: savedPages,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
