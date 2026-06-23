import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_GEMINI_OCR_MODEL = "gemini-2.5-flash";

// Lazy-loaded Gemini client to prevent startup failure when key is unset
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

function getGeminiOcrModel() {
  return process.env.GEMINI_OCR_MODEL?.trim() || DEFAULT_GEMINI_OCR_MODEL;
}

function getPublicationOutputLanguage(publicationName: string) {
  const normalizedName = publicationName.toLowerCase();

  if (normalizedName.includes("daily star")) {
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      publicationName, 
      date, 
      frontPageRawText, 
      backPageRawText, 
      pageThreeRawText,
      jumpPageRawText, 
      jumpPageNumber,
      imageFileBase64, // Optional base64 file data
      imageMimeType,
      imageFiles // Optional array of base64 files
    } = body;
    const outputLanguage = getPublicationOutputLanguage(publicationName || "");
    const languageLockInstruction = getLanguageLockInstruction(outputLanguage);

    // Check key availability first for transparent user reporting
    if (!process.env.GEMINI_API_KEY) {
      const displayPubName = publicationName || "The Daily Star";
      const totalPagesNum = parseInt(jumpPageNumber) ? (parseInt(jumpPageNumber) > 12 ? parseInt(jumpPageNumber) : 12) : 12;
      const displayDate = date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const formatJumpPage = (num: number) => {
        return `P.${num.toString().padStart(2, "0")}`;
      };

      const hasJumpText = !!(jumpPageRawText && jumpPageRawText.length > 10);

      return NextResponse.json({
        success: true,
        isSimulated: true,
        message: "API key is not configured. Running in high-fidelity simulator mode.",
        publication: {
          publicationName: displayPubName,
          date: displayDate,
          edition: "12-Page Print Edition",
          frontPage: [
            {
              title: frontPageRawText && frontPageRawText.length > 20 
                ? (frontPageRawText.length > 80 ? frontPageRawText.substring(0, 80) + "..." : frontPageRawText)
                : "Inflationary pressures reshape national budget outlook and fiscal allocations",
              subheadline: "Finance ministry braces for strict structural guidelines to stabilize reserves",
              byline: "Dhaka, Bangladesh",
              author: "Refayet Ullah Mirdha",
              category: "Lead News",
              summary: frontPageRawText 
                ? `Unified Editorial Summary (Consolidating the Front Page Lead with Page P.${jumpPageNumber || 4} continuation details):
Our editorial team has synthesized the raw front-page text with the continuation segment found on page P.${jumpPageNumber || 4}.
From the front page: ${frontPageRawText}
Connecting directly to the continuation page data: ${jumpPageRawText || "Following standard budget alignments, central administrators have announced strict regulatory measures over reserves to stabilize pricing models."}
This consolidated coverage of the macroeconomic landscape details both immediate challenges, including supply chain bottlenecks and rising fuel costs, and official policy responses, such as high-impact infrastructure subsidies designed to absorb global shocks and protect local currency values.`
                : `This national macroeconomic digest consolidates the front-page lead with detailed fiscal data continued on page P.${jumpPageNumber || 4}. Consumer inflation has climbed to a multi-month high, driven by elevated international fuel costs and chronic port congestion. In response, the Ministry of Finance and the central bank are deploying strict structural guidelines to protect foreign exchange reserves and minimize currency depreciation. According to the continuation segment on page P.${jumpPageNumber || 4}, these measures focus heavily on limiting non-essential luxury imports, adjusting interest rates, and redirecting liquidity to rural developmental clusters. While trade unions and business leaders acknowledge these measures are necessary to curb speculative pricing, they warn that micro and small enterprises may experience short-term credit rationing. Moving forward, the government is prioritizing key public-private partnerships to sustain employment and insulate the national economy against external geopolitical disruptions.`,
              originPage: "P.01",
              jumpMerged: jumpPageNumber ? formatJumpPage(parseInt(jumpPageNumber)) : "P.04",
              jumpDetails: `Jump news trace consolidated cleanly. Merged lead report from Page 1 with secondary columns on Page ${jumpPageNumber || 4}.`
            },
            {
              title: "Digital Tech Initiatives Receive National Support Package",
              subheadline: "Cabinet approves tax holidays up to ten years for IT clusters and tech hub initiatives",
              byline: "Staff Reporter",
              author: "Naimul Karim",
              category: "Technology",
              summary: "In a landmark initiative to propel the digital economy, the central Cabinet has officially approved a draft finance bill establishing tax holidays of up to ten years for regional IT parks and software development corridors. This supportive legislative framework is specifically designed to attract foreign venture capital and lower operational barriers for early-stage tech start-ups and software programmers. In addition to tax exemptions, participating tech parks will receive gigabit fiber subsidies, fast-track intellectual property registration, and specialized engineering training programs. Local trade bodies and industry leaders have widely praised the policy, projecting it will create over 50,000 high-skilled jobs and double IT export revenues within the next five years.",
              originPage: "P.01"
            }
          ],
          pageThree: [
            {
              title: pageThreeRawText && pageThreeRawText.length > 20
                ? (pageThreeRawText.length > 80 ? pageThreeRawText.substring(0, 80) + "..." : pageThreeRawText)
                : "Dhaka air standard deteriorates under dust control failures",
              subheadline: "Environment enforcement units planning snap compliance inspections on capital construction sites",
              byline: "Metro Desk",
              author: "Mohammad Al-Masum Molla",
              category: "National",
              summary: pageThreeRawText 
                ? `Unified Metropolitan Digest (Page 3 Metropolitan News consolidated with continuation details from Page P.${jumpPageNumber || 4}):
${pageThreeRawText}
${hasJumpText ? `\n\nPage 3 Continuation [PAGE 3 JUMP MERGED FROM P.${jumpPageNumber || 4}]:\n${jumpPageRawText}` : "\n\nFollowing up on these regional environmental issues, metropolitan enforcement divisions have prepared a roster of unannounced physical audits. They are empowered to issue immediate halt-work directives and apply hefty financial penalties to any site repeating dust-mitigation failures."}
This comprehensive report bridges local civic complaints regarding poor air standards directly with national regulatory penalties and compliance tracking, laying out the full operational plan of action to mitigate urban health risks.`
                : "Air quality indicators across major metropolitan zones have deteriorated significantly ahead of the upcoming dry season, prompting sharp criticism from health experts. The local environmental agency has traced a large portion of the suspended dust particles to systemic dust-suppression failures in active construction sites for high-capacity transit and real estate projects. In response, environmental task forces are launching an aggressive campaign of unannounced physical compliance audits starting this Wednesday. These teams are authorized to levy immediate cease-and-desist mandates and heavy financial penalties on non-compliant developers. Concurrently, municipal health centers are bracing for an influx of respiratory cases, urging children, the elderly, and vulnerable demographics to wear high-efficiency masks while commuting.",
              originPage: "P.03",
              jumpMerged: hasJumpText ? (jumpPageNumber ? formatJumpPage(parseInt(jumpPageNumber)) : "P.04") : undefined,
              jumpDetails: hasJumpText ? `Page 3 Jump Matching Trace: Detected connection 'Continued on Page ${jumpPageNumber || 4}'. Integrated enforcement roster details from continuation segment.` : undefined
            }
          ],
          backPage: [
            {
              title: backPageRawText && backPageRawText.length > 20
                ? (backPageRawText.length > 80 ? backPageRawText.substring(0, 80) + "..." : backPageRawText)
                : "National Cricket Academy announces intensive preparation schedule ahead of international fixtures",
              subheadline: "Top fast-bowlers placed under special endurance modules with state therapists",
              byline: "Sports Correspondent",
              author: "Mazhar Uddin",
              category: "Sports",
              summary: backPageRawText
                ? `Unified Sports Summary (Back Page and Continuation Page 9):
${backPageRawText}
By integrating the secondary physical fitness ledgers and therapist feedback, our desk has compiled a complete overview. Bowlers are undergoing precise biomechanical tracking, optimizing muscle recovery, and performing high-impact strength-building drills to ensure peak performance and maintain a healthy, injury-free squad for the upcoming multi-stage tours.`
                : "The National Cricket Academy has officially launched an intensive high-performance preparation camp in Dhaka to prepare the national squad for upcoming international tours. Under the guidance of imported biomechanics experts and sports science therapists, key fast-bowlers have been placed in specialized physical endurance and muscle-recovery modules. These routines are designed to monitor daily workload metrics, optimize delivery stride mechanics, and build deep shoulder strength to prevent soft-tissue injuries during long series. Selectors indicated that physical fitness stats and recovery performance monitored over this two-week training cycle will be heavily weighted during upcoming player squad selections.",
              originPage: `P.12`,
              jumpMerged: "P.09",
              jumpDetails: "Automatically detected continuation details from inner pages. Joined individual fitness stats."
            },
            {
              title: "Annual Fine Arts Exhibition attracts global curator delegations",
              subheadline: "Over one hundred curated masterpieces reflecting identity and rural heritage on grand display",
              byline: "Art Critic Desk",
              author: "Shayan S. Khan",
              category: "Arts & Culture",
              summary: "The annual metropolitan Fine Arts Exhibition has officially opened its doors, hosting a prominent delegation of international museum curators, cultural historians, and global collectors. This year's showcase features over one hundred curated paintings, sculptures, and modern textile installations that express themes of socio-cultural identity, rural heritage, and the fast-moving currents of globalization. Side-panels and academic workshops during the exhibition will explore the active preservation of indigenous craft techniques in modern art education. Visiting curators praised the visual craftsmanship, bold color palettes, and intense expressive depth displayed by the current wave of contemporary artists.",
              originPage: `P.12`
            }
          ]
        }
      });
    }

    const ai = getGeminiClient();

    // Prepare content parts for Gemini
    let prompt = "";
    const parts: any[] = [];

    if (imageFiles && Array.isArray(imageFiles) && imageFiles.length > 0) {
      // Multiple files/pages uploaded together (including multi-page scans or multi-page PDFs)
      imageFiles.forEach((fileObj: any) => {
        if (fileObj.base64 && fileObj.mimeType) {
          parts.push({
            inlineData: {
              mimeType: fileObj.mimeType,
              data: fileObj.base64
            }
          });
        }
      });
      prompt = `You are a prestigious Chief Newspaper Editor and lead curator. Your task is to analyze these ${imageFiles.length} uploaded newspaper page images (or PDF pages), identify its news stories, and compile them into extremely high-fidelity, deep, and cohesive articles.
Your publication is: "${publicationName || "Draft Scan"}". Date is: "${date || "Today"}".
The required output language is: ${outputLanguage}.
${languageLockInstruction}

For each news story across these newspaper pages, please extract and synthesize:
- title: A powerful, high-impact main headline in ${outputLanguage}.
- subheadline: A beautifully descriptive secondary summary tagline context line in ${outputLanguage}.
- byline: Reporting location/desk in ${outputLanguage}.
- author: The dedicated writer/reporter's name if explicitly listed; otherwise use the natural ${outputLanguage} equivalent of "Reporter".
- category: A concise newsroom category in ${outputLanguage}.
- summary: A highly detailed, editorial-grade narrative summary in ${outputLanguage} (at least 3 to 5 substantial sentences, 100-150 words) structured as a complete news capsule. Do NOT write brief, generic, or truncated summaries. You must fully explain the entire context, key individuals or organizations involved, statistical numbers, crucial event occurrences, official response, underlying causes, consequences, and conclusion. If a story has pointers or links indicating a jump/continuation on another page (or if the story's continuation is present on another of the uploaded pages), you MUST automatically fuse, align, and consolidate those continuation segments cleanly into this single summary so that the story is fully resolved.
- originPage: The source page of the lead story (e.g. "P.01", "P.03", "P.16" depending on which page holds the main story start).
- jumpMerged: If you bridged or merged information for this story from another page, specify the page number (e.g., "P.04" or "P.12").
- jumpDetails: If bridged or merged, provide an explanation trace in ${outputLanguage} explaining exactly which details were unified from the jump page.

Please categorize the final extracted stories into frontPage (stories from Page 1), pageThree (local/metro stories from Page 3), and backPage (sports, culture, or final page stories) as cleanly and logically as possible, so they map perfectly into our 3-column newspaper dashboard layout. Ensure the resulting summaries act as an authoritative and complete digest allowing any reader to fully understand the entire issue without requiring external context.`;
    } else if (imageFileBase64 && imageMimeType) {
      // Multimodal processing of single newspaper image/page scan
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: imageFileBase64
        }
      });
      prompt = `You are a prestigious Chief Newspaper Editor and lead curator. Your task is to analyze this uploaded newspaper page image, identify its news stories, and compile them into extremely high-fidelity, deep, and cohesive articles.
Your publication is: "${publicationName || "Draft Scan"}". Date is: "${date || "Today"}".
The required output language is: ${outputLanguage}.
${languageLockInstruction}

For each news story on this page, please extract and synthesize:
- title: A powerful, high-impact main headline in ${outputLanguage}.
- subheadline: A beautifully descriptive secondary summary tagline context line in ${outputLanguage}.
- byline: Reporting location/desk in ${outputLanguage}.
- author: The dedicated writer/reporter's name if explicitly listed; otherwise use the natural ${outputLanguage} equivalent of "Reporter".
- category: A concise newsroom category in ${outputLanguage}.
- summary: A highly detailed, editorial-grade narrative summary in ${outputLanguage} (at least 3 to 5 substantial sentences, 100-150 words) structured as a complete news capsule. Do NOT write brief, generic, or truncated summaries. You must fully explain the entire context, key individuals or organizations involved, statistical numbers, crucial event occurrences, official responses, underlying causes, consequences, and conclusion. If the story has pointers or links indicating a jump/continuation on another page, outline that connection and describe how the narrative would develop.
- originPage: The source page being scanned (e.g. "P.01", "P.03", "P.12").

Ensure the resulting summaries act as an authoritative and complete digest allowing any reader to fully understand the entire issue without requiring external context.`;
    } else {
      // Text-based OCR consolidation & synthesis prompt
      prompt = `You are a prestigious Chief Newspaper Editor and OCR Synthesizer. Your absolute standard is to collect, clean, and consolidate the provided multi-page newspaper text segments into an elegant, high-fidelity publication summary.

Your goal is to ensure the reader receives an exceptionally comprehensive, context-rich, narrative news digest of each major news story.

Publication: ${publicationName || "E-Paper"}
Date: ${date || "Current"}
The required output language is: ${outputLanguage}.
${languageLockInstruction}

--- FRONT PAGE RAW TEXT ---
${frontPageRawText || "No raw text provided"}

--- PAGE 3 RAW TEXT ---
${pageThreeRawText || "No raw text provided"}

--- BACK PAGE RAW TEXT ---
${backPageRawText || "No raw text provided"}

--- JUMP/CONTINUATION PAGE (P.0${jumpPageNumber || 4}) RAW TEXT ---
${jumpPageRawText || "No raw text provided"}

INSTRUCTIONS:
1. FRONT PAGE STORIES (Identify 2-3 prominent news stories from the FRONT PAGE):
   - title: high-impact main headline in ${outputLanguage}
   - subheadline: descriptive secondary summary tagline context line in ${outputLanguage}
   - byline: reporting location/desk in ${outputLanguage}
   - author: the writer/reporter's name
   - category: concise newsroom category in ${outputLanguage}
   - originPage: 'P.01'
   - summary: Compile each story in ${outputLanguage} into a deep, editorial-grade narrative news digest (at least 3 to 5 substantial sentences, 100-150 words) that details the core issue, key statistical metrics, quotes, names of organizations/officials, responses, consequences, conclusion, and future outlook. Cover the 'Who, What, Where, When, and Why' thoroughly so the reader fully understands the entire news story.

2. PAGE 3 (METROPOLITAN/LOCAL) STORIES (Identify 1-2 stories from PAGE 3):
   - summary: Provide a complete metropolitan narrative (at least 3 to 5 sentences) explaining the local dynamics, administrative interventions, resident impact, and civic solutions.

3. BACK PAGE (SPORTS/ARTS/METEOROLOGY) STORIES (Identify 1-2 stories from the BACK PAGE):
   - summary: Formulate a detailed sports, cultural, or environmental narrative (at least 3 to 5 sentences) covering match analytics, team updates, curatorial feedback, or weather warnings.

4. CRITICAL JUMP SEAMLESS FUSION LOGIC (FOR FRONT PAGE AND PAGE 3):
   - Carefully read and analyze the JUMP/CONTINUATION page text. 
   - Identify which blocks of text continue stories from either the FRONT PAGE or PAGE 3.
   - You MUST cleanly fuse and synthesize the continuation details directly into the parent story's 'summary' field in ${outputLanguage}. Form a single, perfectly unified, continuous, and satisfying journalistic review that preserves the full main theme.
   - Set "jumpMerged" to "P.0${jumpPageNumber || 4}" and put a precise ${outputLanguage} log trace in "jumpDetails" explaining exactly which continuation details, numbers, or statements were unified from the jump page to build the complete story.
   - Incorporate the jump details directly into that story's "summary"!

5. Return a clean, well-synthesized response conforming strictly to the structured JSON schema. Ensure absolutely that NO summaries are left as a brief 1-2 sentence preview or left with unresolved loose ends. The summary should be so thorough that reading it tells the entire news story. Do not output anything other than JSON.`;
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: getGeminiOcrModel(),
      contents: parts,
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
              description: "Array of front page news summaries, incorporating jump continuations if found",
              items: {
                type: Type.OBJECT,
                required: ["title", "category", "summary", "originPage"],
                properties: {
                  title: { type: Type.STRING },
                  subheadline: { type: Type.STRING },
                  byline: { type: Type.STRING },
                  author: { type: Type.STRING },
                  category: { type: Type.STRING },
                  summary: { type: Type.STRING, description: "An exceptionally comprehensive, editorial-grade narrative news summary (at least 3-5 substantial sentences, 100-150 words). If a jump/continuation segment is parsed, it must be cleanly synthesized directly into this field, forming a single rich, cohesive, and complete narrative digest. Explain all key facts, actors, events, data/stats, consequences, and conclusions so the reader fully understands the story." },
                  originPage: { type: Type.STRING },
                  jumpMerged: { type: Type.STRING, description: "If jump news was merged, specify page number (e.g., 'P.04'). Otherwise omit or set empty." },
                  jumpDetails: { type: Type.STRING, description: "A detailed trace explaining the continuation text found and compiled into the parent summary." }
                }
              }
            },
            pageThree: {
              type: Type.ARRAY,
              description: "Array of page 3 (local/metropolitan) news summaries, incorporating jump continuations if found",
              items: {
                type: Type.OBJECT,
                required: ["title", "category", "summary", "originPage"],
                properties: {
                  title: { type: Type.STRING },
                  subheadline: { type: Type.STRING },
                  byline: { type: Type.STRING },
                  author: { type: Type.STRING },
                  category: { type: Type.STRING },
                  summary: { type: Type.STRING, description: "An exceptionally comprehensive, editorial-grade narrative news summary (at least 3-5 substantial sentences, 100-150 words). If a jump/continuation segment is parsed, it must be cleanly synthesized directly into this field, forming a single rich, cohesive, and complete narrative digest. Explain all key facts, actors, events, data/stats, consequences, and conclusions so the reader fully understands the story." },
                  originPage: { type: Type.STRING },
                  jumpMerged: { type: Type.STRING, description: "If jump news was merged, specify page number (e.g., 'P.04'). Otherwise omit or set empty." },
                  jumpDetails: { type: Type.STRING, description: "A detailed trace explaining the continuation text found and compiled into the parent summary." }
                }
              }
            },
            backPage: {
              type: Type.ARRAY,
              description: "Array of back page news summaries",
              items: {
                type: Type.OBJECT,
                required: ["title", "category", "summary", "originPage"],
                properties: {
                  title: { type: Type.STRING },
                  subheadline: { type: Type.STRING },
                  byline: { type: Type.STRING },
                  author: { type: Type.STRING },
                  category: { type: Type.STRING },
                  summary: { type: Type.STRING, description: "Detailed editorial-grade story summary (at least 3-5 substantial sentences, 100-150 words) capturing full sporting, artistic, or weather narratives so that the target topic is completely understood." },
                  originPage: { type: Type.STRING },
                  jumpMerged: { type: Type.STRING, description: "If jump news was matched and merged, specify page number." },
                  jumpDetails: { type: Type.STRING, description: "Details on what continuation details were located and compiled." }
                }
              }
            }
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No output text received from processing core");
    }

    const parsedData = JSON.parse(textOutput);
    return NextResponse.json({
      success: true,
      isSimulated: false,
      publication: parsedData
    });

  } catch (error: any) {
    console.error("Gemini Ingestion Route Failure:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "An unexpected error occurred during page analysis"
    }, { status: 500 });
  }
}
