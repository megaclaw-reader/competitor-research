export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  domain: string;
}

export interface MapsResult {
  title: string;
  address: string;
  domain?: string;
  link?: string;
  rating?: number;
  reviews?: number;
  position: number;
}

export interface SearchResults {
  query: string;
  organic: SearchResult[];
  maps: MapsResult[];
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function searchGoogle(
  query: string,
  apiKey: string,
  location?: string
): Promise<SearchResults> {
  const body: Record<string, any> = { q: query, num: 10 };
  if (location) body.location = location;

  const [organicRes, mapsRes] = await Promise.all([
    fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json()).catch(() => ({})),
    location
      ? fetch("https://google.serper.dev/maps", {
          method: "POST",
          headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q: query, location }),
          signal: AbortSignal.timeout(8000),
        }).then((r) => r.json()).catch(() => ({}))
      : Promise.resolve({}),
  ]);

  const organic: SearchResult[] = (organicRes.organic || []).map(
    (r: any, i: number) => ({
      title: r.title || "",
      link: r.link || "",
      snippet: r.snippet || "",
      position: r.position || i + 1,
      domain: getDomain(r.link || ""),
    })
  );

  const maps: MapsResult[] = (mapsRes.places || []).map(
    (r: any, i: number) => ({
      title: r.title || "",
      address: r.address || "",
      link: r.website || undefined,
      domain: r.website ? getDomain(r.website) : undefined,
      rating: r.rating,
      reviews: r.ratingCount,
      position: i + 1,
    })
  );

  return { query, organic, maps };
}

export async function searchAllQueries(
  queries: string[],
  apiKey: string,
  location?: string
): Promise<SearchResults[]> {
  const results: SearchResults[] = [];
  const batchSize = 4;

  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((q) => searchGoogle(q, apiKey, location))
    );
    results.push(...batchResults);
  }

  return results;
}
