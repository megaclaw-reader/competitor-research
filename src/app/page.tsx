"use client";

import { useState } from "react";

interface Competitor {
  domain: string;
  url: string;
  name: string;
  reason: string;
  keywordOverlap: number;
  totalQueries: number;
  bestPosition: number;
  inMapsPack: boolean;
  mapsRating?: number;
  mapsReviews?: number;
  indexedPages: number;
  trafficScore: number;
}

interface TargetInfo {
  url: string;
  domain: string;
  businessName: string;
  businessType: "local" | "ecommerce" | "national";
  industry: string;
  location: { city: string; state: string } | null;
}

interface ResearchResult {
  target: TargetInfo;
  queriesSearched: string[];
  competitors: Competitor[];
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResearch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          🔍 Competitor Research
        </h1>
        <p className="text-gray-400 text-sm">
          Drop a URL. Get their top SEO competitors in seconds.
        </p>
      </div>

      {/* Input */}
      <div className="flex gap-3 mb-8">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleResearch()}
          placeholder="https://example.com"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
        <button
          onClick={handleResearch}
          disabled={loading || !url.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Researching...
            </span>
          ) : (
            "Find Competitors"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 mb-6 text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Target summary */}
          <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-medium text-gray-400">Target:</span>
              <span className="font-semibold">{result.target.businessName}</span>
              <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                {result.target.businessType}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
              <span>🏷️ {result.target.industry}</span>
              {result.target.location && (
                <span>
                  📍 {result.target.location.city}, {result.target.location.state}
                </span>
              )}
              <span>🔎 {result.queriesSearched.length} queries searched</span>
            </div>
          </div>

          {/* Competitors */}
          {result.competitors.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              No competitors found. The site may be too new or niche.
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                Top Competitors ({result.competitors.length}) — sorted by estimated traffic
              </h2>
              {result.competitors.map((comp, i) => (
                <div
                  key={comp.domain}
                  className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-600 text-sm font-mono w-5">
                          {i + 1}.
                        </span>
                        <a
                          href={comp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 font-medium truncate"
                        >
                          {comp.domain}
                        </a>
                        {comp.inMapsPack && (
                          <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">
                            📍 Maps Pack
                          </span>
                        )}
                        {comp.bestPosition <= 3 && (
                          <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full">
                            🏆 Top 3
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 ml-7">{comp.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-500">
                        {comp.keywordOverlap}/{comp.totalQueries} keywords
                      </div>
                      <div className="text-xs text-gray-500">
                        {comp.indexedPages > 0
                          ? `${comp.indexedPages.toLocaleString()} pages indexed`
                          : `best pos: #${comp.bestPosition}`}
                      </div>
                      <div className="text-xs font-mono text-gray-600 mt-0.5">
                        traffic: {comp.trafficScore > 0 ? comp.trafficScore : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Queries used */}
          <details className="mt-6">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-400">
              Show search queries used
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.queriesSearched.map((q) => (
                <span
                  key={q}
                  className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded"
                >
                  {q}
                </span>
              ))}
            </div>
          </details>
        </div>
      )}
    </main>
  );
}
