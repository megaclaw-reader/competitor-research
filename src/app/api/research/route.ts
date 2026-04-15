import { NextRequest, NextResponse } from "next/server";
import { scrapeSite } from "@/lib/scraper";
import { analyzeSite } from "@/lib/analyzer";
import { searchAllQueries, SearchResults } from "@/lib/search";
import { isChainOrDirectory, isMarketplace } from "@/lib/chains";

export const maxDuration = 30;

interface CompetitorScore {
  domain: string;
  name: string;
  url: string;
  organicAppearances: number;
  mapsAppearances: number;
  avgPosition: number;
  bestPosition: number;
  inMapsPack: boolean;
  queriesFound: string[];
  snippets: string[];
  mapsRating?: number;
  mapsReviews?: number;
  totalScore: number;
  indexedPages?: number;
  trafficScore?: number;
}

function scoreCompetitors(
  searchResults: SearchResults[],
  targetDomain: string,
  businessType: "local" | "ecommerce" | "national"
): CompetitorScore[] {
  const competitors = new Map<string, CompetitorScore>();

  for (const sr of searchResults) {
    for (const result of sr.organic) {
      const domain = result.domain;
      if (domain === targetDomain) continue;
      if (businessType === "local" && isChainOrDirectory(domain)) continue;
      if (businessType === "ecommerce" && (isMarketplace(domain) || isChainOrDirectory(domain))) continue;
      if (businessType === "national" && isChainOrDirectory(domain)) continue;

      if (!competitors.has(domain)) {
        competitors.set(domain, {
          domain, name: result.title.split(/[|–—\-:]/)[0]?.trim() || domain,
          url: result.link, organicAppearances: 0, mapsAppearances: 0,
          avgPosition: 0, bestPosition: 100, inMapsPack: false,
          queriesFound: [], snippets: [], totalScore: 0,
        });
      }

      const comp = competitors.get(domain)!;
      comp.organicAppearances++;
      comp.avgPosition = (comp.avgPosition * (comp.organicAppearances - 1) + result.position) / comp.organicAppearances;
      comp.bestPosition = Math.min(comp.bestPosition, result.position);
      if (!comp.queriesFound.includes(sr.query)) comp.queriesFound.push(sr.query);
      if (result.snippet && comp.snippets.length < 3) comp.snippets.push(result.snippet);
    }

    for (const result of sr.maps) {
      if (!result.domain || result.domain === targetDomain) continue;
      if (isChainOrDirectory(result.domain)) continue;

      if (!competitors.has(result.domain)) {
        competitors.set(result.domain, {
          domain: result.domain, name: result.title,
          url: result.link || `https://${result.domain}`,
          organicAppearances: 0, mapsAppearances: 0,
          avgPosition: 0, bestPosition: 100, inMapsPack: false,
          queriesFound: [], snippets: [], totalScore: 0,
        });
      }

      const comp = competitors.get(result.domain)!;
      comp.mapsAppearances++;
      comp.inMapsPack = true;
      comp.mapsRating = result.rating;
      comp.mapsReviews = result.reviews;
      if (!comp.queriesFound.includes(sr.query)) comp.queriesFound.push(sr.query);
    }
  }

  const totalQueries = searchResults.length;
  for (const comp of competitors.values()) {
    const overlapPct = comp.queriesFound.length / totalQueries;
    const positionScore = Math.max(0, (15 - comp.avgPosition) / 15);
    const mapsBonus = comp.inMapsPack ? 2 : 0;
    const frequencyScore = comp.organicAppearances + comp.mapsAppearances;

    comp.totalScore = overlapPct * 40 + positionScore * 20 + frequencyScore * 3 + mapsBonus * 10;
  }

  return Array.from(competitors.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 8);
}

function generateReason(comp: CompetitorScore, totalQueries: number): string {
  const parts: string[] = [];

  if (comp.inMapsPack) {
    parts.push(`In Google Maps Pack`);
    if (comp.mapsRating && comp.mapsReviews) {
      parts.push(`${comp.mapsRating}★ (${comp.mapsReviews.toLocaleString()} reviews)`);
    }
  }

  const pct = Math.round((comp.queriesFound.length / totalQueries) * 100);
  parts.push(`Ranks for ${comp.queriesFound.length}/${totalQueries} keywords (${pct}% overlap)`);

  if (comp.bestPosition <= 3) {
    parts.push(`top 3 for "${comp.queriesFound[0]}"`);
  } else if (comp.bestPosition <= 10) {
    parts.push(`page 1 for "${comp.queriesFound[0]}"`);
  }

  return parts.join(". ") + ".";
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Search API not configured" }, { status: 500 });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http")) normalizedUrl = `https://${normalizedUrl}`;

    let signals;
    try {
      signals = await scrapeSite(normalizedUrl);
    } catch {
      // If scraping fails, build minimal signals from the domain
      const domain = new URL(normalizedUrl).hostname.replace(/^www\./, "");
      signals = {
        url: normalizedUrl, domain, title: domain, metaDescription: "",
        metaKeywords: [], h1s: [], h2s: [], schemaData: [],
        addressText: null, city: null, state: null, zip: null, phone: null,
        hasEcomSignals: false, serviceKeywords: [], bodyText: "",
      };
    }

    // If scrape was thin (blocked/placeholder), do a Serper search on the domain to learn about the business
    const isThinScrape = signals.title.length < 10 || 
      signals.title.toLowerCase().includes("403") || 
      signals.title.toLowerCase().includes("forbidden") ||
      signals.title.toLowerCase().includes("rejected") ||
      signals.title.toLowerCase().includes("coming soon") ||
      (signals.metaDescription.length < 10 && signals.h1s.length === 0);

    if (isThinScrape) {
      try {
        const infoRes = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": apiKey!, "Content-Type": "application/json" },
          body: JSON.stringify({ q: signals.domain, num: 5 }),
          signal: AbortSignal.timeout(5000),
        });
        const infoData = await infoRes.json();
        const topResult = infoData.organic?.[0];
        const kg = infoData.knowledgeGraph;

        if (kg) {
          signals.title = kg.title || signals.title;
          signals.metaDescription = kg.description || signals.metaDescription;
          if (kg.type) signals.h1s = [kg.type, ...signals.h1s];
          if (kg.attributes?.Address) {
            signals.bodyText += ` ${kg.attributes.Address}`;
          }
        } else if (topResult) {
          signals.title = topResult.title || signals.title;
          signals.metaDescription = topResult.snippet || signals.metaDescription;
        }
      } catch {}
    }

    const analysis = analyzeSite(signals);

    const locationStr = analysis.location
      ? `${analysis.location.city}, ${analysis.location.state}`
      : undefined;

    const searchResults = await searchAllQueries(analysis.searchQueries, apiKey, locationStr);

    const competitors = scoreCompetitors(searchResults, signals.domain, analysis.businessType);

    // Enrich: count indexed pages via site: search (Serper returns organic results, count them)
    const enrichBatch = 4;
    for (let i = 0; i < competitors.length; i += enrichBatch) {
      const batch = competitors.slice(i, i + enrichBatch);
      await Promise.all(
        batch.map(async (comp) => {
          try {
            const res = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: { "X-API-KEY": apiKey!, "Content-Type": "application/json" },
              body: JSON.stringify({ q: `site:${comp.domain}`, num: 100 }),
              signal: AbortSignal.timeout(5000),
            });
            const data = await res.json();
            comp.indexedPages = data.organic?.length || 0;
            // If we got 100, there's likely more — flag as 100+
          } catch {
            comp.indexedPages = 0;
          }
        })
      );
    }

    // Calculate traffic score and re-sort
    for (const comp of competitors) {
      const pages = Math.max(comp.indexedPages || 1, 1);
      const posQuality = Math.max(0.1, (20 - comp.avgPosition) / 20);
      const kwCoverage = comp.queriesFound.length / analysis.searchQueries.length;
      const mapsBoost = comp.inMapsPack ? 1.5 : 1;
      const reviewBoost = comp.mapsReviews ? Math.min(Math.log10(comp.mapsReviews) / 3, 1.5) : 1;

      // Score: pages × position quality × keyword coverage × maps presence × reviews
      comp.trafficScore = Math.round(pages * posQuality * kwCoverage * mapsBoost * reviewBoost * 10);
    }

    competitors.sort((a, b) => (b.trafficScore || 0) - (a.trafficScore || 0));

    const results = competitors.map((comp) => ({
      domain: comp.domain,
      url: comp.url,
      name: comp.name,
      reason: generateReason(comp, analysis.searchQueries.length),
      keywordOverlap: comp.queriesFound.length,
      totalQueries: analysis.searchQueries.length,
      bestPosition: comp.bestPosition,
      inMapsPack: comp.inMapsPack,
      mapsRating: comp.mapsRating,
      mapsReviews: comp.mapsReviews,
      indexedPages: comp.indexedPages || 0,
      trafficScore: comp.trafficScore || 0,
    }));

    return NextResponse.json({
      target: {
        url: normalizedUrl,
        domain: signals.domain,
        businessName: analysis.businessName,
        businessType: analysis.businessType,
        industry: analysis.industry,
        location: analysis.location,
      },
      queriesSearched: analysis.searchQueries,
      competitors: results,
    });
  } catch (err: any) {
    console.error("Research error:", err);
    return NextResponse.json({ error: err.message || "Research failed" }, { status: 500 });
  }
}
