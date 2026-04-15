import { SiteSignals } from "./scraper";

export interface SiteAnalysis {
  businessName: string;
  businessType: "local" | "ecommerce" | "national";
  industry: string;
  location: { city: string; state: string } | null;
  primaryKeywords: string[];
  searchQueries: string[];
}

function extractBusinessName(signals: SiteSignals): string {
  // Try schema
  for (const s of signals.schemaData) {
    if (s.name) return s.name;
  }
  // From title — usually "Business Name | Tagline" or "Business Name - City"
  const title = signals.title;
  const parts = title.split(/[|–—\-:]/).map((p) => p.trim());
  if (parts.length > 0 && parts[0].length > 2 && parts[0].length < 60) return parts[0];
  return signals.domain;
}

function inferIndustry(signals: SiteSignals): string {
  const text = `${signals.title} ${signals.metaDescription} ${signals.h1s.join(" ")} ${signals.h2s.join(" ")}`.toLowerCase();

  const industries: [string, RegExp[]][] = [
    ["plumbing", [/plumb/i, /drain/i, /pipe/i, /water heater/i]],
    ["hvac", [/hvac/i, /heating/i, /air condition/i, /furnace/i, /cool(?:ing)?/i]],
    ["roofing", [/roof/i, /shingle/i, /gutter/i]],
    ["dental", [/dent(?:al|ist)/i, /orthodont/i, /teeth/i, /oral/i]],
    ["legal", [/law(?:yer|firm| office)/i, /attorney/i, /legal/i, /litigation/i]],
    ["real estate", [/real\s*estate/i, /realtor/i, /realt/i, /home.*(?:buy|sell|listing)/i]],
    ["medical", [/doctor/i, /medical/i, /clinic/i, /physician/i, /health\s*care/i, /patient/i]],
    ["restaurant", [/restaurant/i, /menu/i, /dining/i, /cuisine/i, /reservat/i]],
    ["automotive repair", [/auto.*repair/i, /mechanic/i, /oil change/i, /brake/i, /car repair/i]],
    ["landscaping", [/landscap/i, /lawn/i, /garden/i, /mowing/i, /tree.*(?:service|remov|trim)/i]],
    ["cleaning", [/clean(?:ing|ers)/i, /janitorial/i, /maid/i, /housekeep/i]],
    ["pest control", [/pest/i, /exterminat/i, /termite/i, /rodent/i, /bug/i]],
    ["moving", [/mov(?:ing|ers)/i, /relocation/i, /pack(?:ing|ers)/i]],
    ["construction", [/construct/i, /general contractor/i, /build(?:er|ing)/i, /remodel/i, /renovat/i]],
    ["fitness", [/gym/i, /fitness/i, /personal train/i, /workout/i, /crossfit/i]],
    ["salon/spa", [/salon/i, /spa\b/i, /hair/i, /beauty/i, /massage/i, /nail/i, /facial/i]],
    ["insurance", [/insurance/i, /coverage/i, /policy/i, /claim/i]],
    ["accounting", [/account(?:ing|ant)/i, /tax.*(?:prep|service|return)/i, /bookkeep/i, /cpa\b/i]],
    ["photography", [/photograph/i, /photo.*(?:session|shoot)/i, /portrait/i, /wedding.*photo/i]],
    ["ecommerce", [/shop/i, /store/i, /buy.*online/i, /free.*shipping/i, /product/i]],
    ["entertainment", [/entertain/i, /event/i, /ticket/i, /show/i, /attraction/i, /haunted/i, /amusement/i]],
    ["education", [/school/i, /tutor/i, /learn/i, /educat/i, /training/i, /course/i]],
    ["financial services", [/financ/i, /invest/i, /wealth/i, /mortgage/i, /loan/i, /credit/i]],
    ["home services", [/home.*(?:service|repair|improvement)/i, /handyman/i, /electrician/i, /garage.*door/i]],
    ["veterinary", [/vet(?:erinar)/i, /animal.*(?:hospital|clinic)/i, /pet.*(?:care|health)/i]],
    ["technology", [/software/i, /saas/i, /app\b/i, /tech(?:nolog)/i, /digital/i, /it\s*service/i]],
  ];

  let bestMatch = "general business";
  let bestScore = 0;
  for (const [industry, patterns] of industries) {
    const score = patterns.filter((p) => p.test(text)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = industry;
    }
  }
  return bestMatch;
}

function generateSearchQueries(
  signals: SiteSignals,
  industry: string,
  location: { city: string; state: string } | null,
  businessType: "local" | "ecommerce" | "national"
): string[] {
  const queries: string[] = [];

  // Build keyword base from title + meta + h1s
  const rawKeywords: string[] = [];

  // Extract meaningful phrases from title
  const titleClean = signals.title
    .replace(/[|–—\-:]/g, " ")
    .replace(signals.domain, "")
    .replace(/\.com|\.net|\.org/gi, "")
    .trim();
  if (titleClean.length > 3) rawKeywords.push(titleClean);

  // From meta description — grab first clause
  if (signals.metaDescription) {
    const firstClause = signals.metaDescription.split(/[.,!?]/).filter((c) => c.trim().length > 10)[0];
    if (firstClause) rawKeywords.push(firstClause.trim());
  }

  // H1s are usually very descriptive
  rawKeywords.push(...signals.h1s);

  // Meta keywords if available
  rawKeywords.push(...signals.metaKeywords.slice(0, 5));

  // Schema-based keywords
  for (const s of signals.schemaData) {
    if (s.description) rawKeywords.push(s.description.slice(0, 100));
    if (s["@type"] && typeof s["@type"] === "string") {
      rawKeywords.push(s["@type"].replace(/([A-Z])/g, " $1").trim());
    }
  }

  if (businessType === "local" && location) {
    const loc = `${location.city}, ${location.state}`;
    const city = location.city;

    // Industry + location queries
    queries.push(`${industry} ${city}`);
    queries.push(`best ${industry} ${city}`);
    queries.push(`${industry} near ${city}`);
    queries.push(`top ${industry} companies ${loc}`);
    queries.push(`${industry} services ${city}`);

    // Extract more specific services from content
    const topServices = signals.serviceKeywords.slice(0, 3);
    for (const svc of topServices) {
      queries.push(`${svc} ${city}`);
    }

    // "Near me" style
    queries.push(`${industry} near me ${city}`);

    // Review/comparison
    queries.push(`${industry} reviews ${city}`);
  } else if (businessType === "ecommerce") {
    // Product/category focused
    queries.push(`buy ${industry} online`);
    queries.push(`best ${industry} store`);
    queries.push(`${industry} shop online`);
    queries.push(`top ${industry} brands`);

    // From keywords
    for (const kw of rawKeywords.slice(0, 3)) {
      const clean = kw.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      if (clean.length > 5 && clean.length < 60) {
        queries.push(clean);
      }
    }

    for (const svc of signals.serviceKeywords.slice(0, 4)) {
      queries.push(`buy ${svc} online`);
    }
  } else {
    // National/general
    queries.push(`${industry} companies`);
    queries.push(`best ${industry} services`);
    queries.push(`top ${industry} providers`);

    for (const kw of rawKeywords.slice(0, 5)) {
      const clean = kw.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      if (clean.length > 5 && clean.length < 60) queries.push(clean);
    }
  }

  // Deduplicate and limit
  const seen = new Set<string>();
  return queries
    .map((q) => q.toLowerCase().trim())
    .filter((q) => {
      if (seen.has(q) || q.length < 5) return false;
      seen.add(q);
      return true;
    })
    .slice(0, 12);
}

export function analyzeSite(signals: SiteSignals): SiteAnalysis {
  const businessName = extractBusinessName(signals);
  const industry = inferIndustry(signals);

  let businessType: "local" | "ecommerce" | "national" = "local";
  if (signals.hasEcomSignals) {
    businessType = "ecommerce";
  } else if (!signals.city && !signals.state) {
    businessType = "national";
  }

  const location =
    signals.city && signals.state ? { city: signals.city, state: signals.state } : null;

  // Build primary keyword list
  const primaryKeywords = [
    industry,
    ...signals.metaKeywords.slice(0, 5),
    ...signals.serviceKeywords.slice(0, 5),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const searchQueries = generateSearchQueries(signals, industry, location, businessType);

  return {
    businessName,
    businessType,
    industry,
    location,
    primaryKeywords,
    searchQueries,
  };
}
