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
  for (const s of signals.schemaData) {
    if (s.name) return s.name;
  }
  const title = signals.title;
  const parts = title.split(/[|–—\-:]/).map((p) => p.trim());
  if (parts.length > 0 && parts[0].length > 2 && parts[0].length < 60) return parts[0];
  return signals.domain;
}

// Ordered most-specific first so "med spa" beats "salon"
const INDUSTRIES: [string, RegExp[], string[]][] = [
  // --- Highly specific first ---
  ["med spa", [/med\s*spa/i, /medspa/i, /medical\s*spa/i, /botox/i, /filler/i, /coolsculpt/i, /hydrafacial/i, /microneedl/i, /laser\s*(?:hair|skin|treatment)/i, /injectab/i, /aesthetic/i, /rejuvenat/i, /sculpt/i, /body\s*contour/i, /prp\b/i, /iv\s*therapy/i, /dermaplaning/i, /chemical\s*peel/i, /lip\s*filler/i, /kybella/i, /semaglutide/i, /weight\s*loss\s*(?:clinic|injection|treatment)/i],
    ["med spa", "medspa", "medical spa", "aesthetic clinic", "botox", "cosmetic treatments"]],
  ["plastic surgery", [/plastic\s*surg/i, /cosmetic\s*surg/i, /rhinoplast/i, /breast\s*augment/i, /liposuct/i, /tummy\s*tuck/i, /facelift/i, /blepharoplast/i, /mommy\s*makeover/i, /bbl\b/i, /brazilian\s*butt/i],
    ["plastic surgeon", "cosmetic surgery", "plastic surgery clinic"]],
  ["dermatology", [/dermatolog/i, /skin\s*(?:doctor|clinic|care\s*clinic|specialist)/i, /acne\s*treatment/i, /psoriasis/i, /eczema\s*treat/i, /mohs/i, /skin\s*cancer/i],
    ["dermatologist", "dermatology clinic", "skin doctor"]],
  ["chiropractic", [/chiropract/i, /spinal\s*adjust/i, /chiro\b/i],
    ["chiropractor", "chiropractic clinic"]],
  ["physical therapy", [/physical\s*therap/i, /physiotherap/i, /rehab(?:ilitation)?\s*(?:clinic|center|service)/i],
    ["physical therapy clinic", "physical therapist"]],
  ["orthodontics", [/orthodont/i, /braces/i, /invisalign/i, /clear\s*aligner/i],
    ["orthodontist", "braces", "invisalign provider"]],
  ["dental", [/dent(?:al|ist)/i, /teeth/i, /oral\s*(?:surg|health|care)/i, /implant/i, /crown/i, /veneer/i, /root\s*canal/i, /tooth/i],
    ["dentist", "dental clinic", "dental office"]],
  ["optometry", [/optometr/i, /eye\s*(?:doctor|exam|care|clinic)/i, /ophthalmolog/i, /vision/i, /glasses/i, /contact\s*lens/i, /lasik/i],
    ["eye doctor", "optometrist", "vision center"]],
  ["veterinary", [/vet(?:erinar)/i, /animal\s*(?:hospital|clinic)/i, /pet\s*(?:care|health|clinic)/i],
    ["veterinarian", "animal hospital", "vet clinic"]],
  ["hair salon", [/hair\s*(?:salon|styl|cut|color|extension)/i, /barber/i, /blowout/i, /balayage/i, /keratin\s*treat/i],
    ["hair salon", "hairstylist", "barber shop"]],
  ["nail salon", [/nail\s*(?:salon|tech|art|spa)/i, /mani(?:cure)?/i, /pedi(?:cure)?/i, /gel\s*nail/i, /acrylic\s*nail/i],
    ["nail salon", "nail spa"]],
  ["massage therapy", [/massage\s*(?:therap|clinic|studio)/i, /deep\s*tissue/i, /swedish\s*massage/i, /sports\s*massage/i],
    ["massage therapist", "massage clinic"]],
  ["day spa", [/day\s*spa/i, /spa\s*(?:service|treatment|package)/i, /facial(?!.*medical)/i, /body\s*wrap/i, /spa\s*menu/i],
    ["day spa", "spa services"]],
  ["personal injury law", [/personal\s*injury/i, /accident\s*(?:lawyer|attorney)/i, /car\s*accident\s*(?:lawyer|attorney)/i, /slip\s*and\s*fall/i, /wrongful\s*death/i, /injury\s*(?:lawyer|attorney|law)/i],
    ["personal injury lawyer", "accident attorney", "injury law firm"]],
  ["criminal defense law", [/criminal\s*(?:defense|lawyer|attorney)/i, /dui\s*(?:lawyer|attorney)/i, /drug\s*(?:charge|offense)/i, /felony/i, /misdemeanor/i],
    ["criminal defense lawyer", "criminal attorney", "DUI lawyer"]],
  ["family law", [/family\s*law/i, /divorce\s*(?:lawyer|attorney)/i, /child\s*custody/i, /prenup/i, /adoption\s*(?:lawyer|attorney)/i],
    ["family lawyer", "divorce attorney"]],
  ["immigration law", [/immigra(?:tion)?\s*(?:law|lawyer|attorney)/i, /visa\s*(?:lawyer|attorney)/i, /green\s*card/i, /deportation/i],
    ["immigration lawyer", "immigration attorney"]],
  ["legal", [/law(?:yer|firm|\s*office)/i, /attorney/i, /legal\s*(?:service|counsel|represent)/i, /litigation/i],
    ["lawyer", "law firm", "attorney"]],
  ["plumbing", [/plumb/i, /drain/i, /pipe/i, /water\s*heater/i, /sewer/i, /faucet/i, /toilet\s*repair/i],
    ["plumber", "plumbing company", "plumbing services"]],
  ["hvac", [/hvac/i, /heating/i, /air\s*condition/i, /furnace/i, /cool(?:ing)?\s*(?:system|service|repair)/i, /heat\s*pump/i, /duct/i],
    ["HVAC company", "heating and cooling", "AC repair"]],
  ["roofing", [/roof/i, /shingle/i, /gutter/i],
    ["roofing company", "roofer", "roof repair"]],
  ["electrical", [/electric(?:al|ian)/i, /wiring/i, /circuit/i, /panel\s*upgrade/i, /outlet/i, /lighting\s*install/i],
    ["electrician", "electrical contractor"]],
  ["pest control", [/pest/i, /exterminat/i, /termite/i, /rodent/i, /bed\s*bug/i, /mosquito\s*(?:control|treat)/i, /ant\s*control/i],
    ["pest control", "exterminator", "pest removal"]],
  ["landscaping", [/landscap/i, /lawn\s*(?:care|service|maint)/i, /garden/i, /mowing/i, /tree\s*(?:service|remov|trim)/i, /hardscap/i, /irrigation/i],
    ["landscaping company", "lawn care service", "landscaper"]],
  ["cleaning", [/clean(?:ing|ers)\s*(?:service|company)/i, /janitorial/i, /maid/i, /housekeep/i, /carpet\s*clean/i, /pressure\s*wash/i],
    ["cleaning service", "house cleaning", "commercial cleaning"]],
  ["moving", [/mov(?:ing|ers)\s*(?:company|service)/i, /relocation\s*(?:service|company)/i, /pack(?:ing|ers)\s*(?:service)?/i],
    ["moving company", "movers", "relocation service"]],
  ["auto repair", [/auto\s*(?:repair|body|service)/i, /mechanic/i, /oil\s*change/i, /brake\s*(?:repair|service)/i, /car\s*repair/i, /transmission/i, /auto\s*shop/i],
    ["auto repair shop", "mechanic", "car repair"]],
  ["auto dealership", [/(?:car|auto)\s*dealer/i, /pre.owned/i, /used\s*car/i, /new\s*car/i, /certified\s*pre/i, /test\s*drive/i],
    ["car dealership", "auto dealer"]],
  ["real estate", [/real\s*estate/i, /realtor/i, /realt/i, /home.*(?:buy|sell|listing)/i, /property\s*(?:manag|list)/i],
    ["real estate agent", "realtor", "real estate company"]],
  ["restaurant", [/restaurant/i, /menu/i, /dining/i, /cuisine/i, /reservat/i, /catering/i, /chef/i],
    ["restaurant", "dining"]],
  ["construction", [/construct/i, /general\s*contractor/i, /build(?:er|ing)\s*(?:company|service)/i, /remodel/i, /renovat/i, /home\s*build/i],
    ["general contractor", "construction company", "home remodeling"]],
  ["fitness", [/\bgym\b/i, /fitness\s*(?:center|studio|club)/i, /personal\s*train/i, /crossfit/i, /yoga\s*studio/i, /pilates/i],
    ["gym", "fitness center", "personal trainer"]],
  ["insurance", [/insurance\s*(?:agent|agency|company|broker|quote|premium|plan)/i, /(?:auto|home|life|health|car|renters)\s*insurance/i, /insurance\s*(?:coverage|policy|claim)/i, /deductible/i, /underwrit/i],
    ["insurance agent", "insurance company"]],
  ["accounting", [/account(?:ing|ant)/i, /tax\s*(?:prep|service|return)/i, /bookkeep/i, /\bcpa\b/i],
    ["accountant", "CPA", "tax preparation"]],
  ["photography", [/photograph/i, /photo\s*(?:session|shoot|studio)/i, /portrait/i, /wedding\s*photo/i],
    ["photographer", "photography studio"]],
  ["medical practice", [/doctor/i, /medical\s*(?:practice|clinic|center|group)/i, /physician/i, /health\s*care\s*(?:provider|clinic)/i, /primary\s*care/i, /urgent\s*care/i, /family\s*(?:medicine|doctor|practice)/i],
    ["doctor", "medical clinic", "healthcare provider"]],
  ["home services", [/home\s*(?:service|repair|improvement)/i, /handyman/i, /garage\s*door/i, /window\s*(?:install|replace)/i, /siding/i],
    ["home services", "handyman", "home improvement"]],
  ["event planning", [/event\s*(?:plan|design|produc|decor|coordin|styl)/i, /wedding\s*(?:plan|design|coordin|decor)/i, /celebration/i, /brand\s*(?:experience|activation)/i, /corporate\s*event/i, /party\s*(?:plan|rent|decor)/i, /floral\s*(?:design|arrang)/i, /balloon/i, /globo/i, /luxury\s*event/i, /event\s*(?:rental|vendor|florist)/i],
    ["event planner", "event design", "wedding planner", "event decorator"]],
  ["entertainment", [/entertain/i, /event\s*(?:venue|space|center)/i, /ticket/i, /show/i, /attraction/i, /haunted/i, /amusement/i, /bowling/i, /arcade/i, /escape\s*room/i],
    ["entertainment venue", "event space", "attraction"]],
  ["education", [/school/i, /tutor/i, /learn/i, /educat/i, /training\s*(?:center|program)/i, /course/i, /academ/i],
    ["school", "tutoring service", "education center"]],
  ["financial services", [/financ(?:ial)?\s*(?:advis|plann|service)/i, /invest(?:ment)?\s*(?:advis|manag)/i, /wealth\s*manag/i],
    ["financial advisor", "wealth management", "financial planner"]],
  ["mortgage", [/mortgage\s*(?:broker|lend|company|rate)/i, /home\s*loan/i, /refinanc/i],
    ["mortgage broker", "mortgage lender", "home loan"]],
  ["technology", [/software/i, /\bsaas\b/i, /\bapp\b/i, /tech(?:nolog)/i, /\bit\s*service/i, /managed\s*(?:service|it)/i, /cybersecur/i],
    ["software company", "IT services", "tech company"]],
  ["ecommerce", [/shop\s*(?:now|online|our|all|the)/i, /\bonline\s*store\b/i, /buy\s*online/i, /free\s*shipping/i, /add\s*to\s*(?:cart|bag)/i, /product-card/i, /shopify/i, /\/collections\//i],
    ["online store", "ecommerce", "shop"]],
];

function inferIndustry(signals: SiteSignals): { industry: string; querySeeds: string[] } {
  const text = `${signals.title} ${signals.metaDescription} ${signals.h1s.join(" ")} ${signals.h2s.join(" ")} ${signals.bodyText.slice(0, 2000)}`.toLowerCase();

  let bestMatch = "general business";
  let bestSeeds: string[] = ["business"];
  let bestScore = 0;

  for (const [industry, patterns, seeds] of INDUSTRIES) {
    const score = patterns.filter((p) => p.test(text)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = industry;
      bestSeeds = seeds;
    }
  }

  return { industry: bestMatch, querySeeds: bestSeeds };
}

function generateSearchQueries(
  signals: SiteSignals,
  industry: string,
  querySeeds: string[],
  location: { city: string; state: string } | null,
  businessType: "local" | "ecommerce" | "national"
): string[] {
  const queries: string[] = [];

  if (businessType === "local" && location) {
    const city = location.city;
    const loc = `${location.city}, ${location.state}`;

    // Use the precise query seeds — these are industry-specific terms
    for (const seed of querySeeds.slice(0, 3)) {
      queries.push(`${seed} ${city}`);
      queries.push(`best ${seed} ${city}`);
    }
    queries.push(`top ${querySeeds[0]} near ${loc}`);
    queries.push(`${querySeeds[0]} near me ${city}`);
    queries.push(`${querySeeds[0]} reviews ${city}`);

    // Add specific service terms from the site content
    for (const svc of signals.serviceKeywords.slice(0, 2)) {
      if (!querySeeds.some(s => svc.includes(s.toLowerCase().split(" ")[0]))) {
        queries.push(`${svc} ${city}`);
      }
    }
  } else if (businessType === "ecommerce") {
    // For ecom, use the actual product/brand terms from the site
    const titleClean = signals.title.toLowerCase()
      .replace(/[|–—\-:]/g, " ").replace(signals.domain, "").replace(/\.com|\.net|\.org/gi, "")
      .replace(/official\s*site|home|shop|store|free shipping/gi, "").trim();
    const h1Clean = signals.h1s.map(h => h.toLowerCase()).filter(h => h.length > 3 && h.length < 50);

    // Use title/h1 content which usually describes what they sell
    const productTerms = [titleClean, ...h1Clean].filter(t => t.length > 3).slice(0, 3);
    for (const term of productTerms) {
      queries.push(term);
      queries.push(`${term} alternatives`);
    }

    // Also use industry seeds
    for (const seed of querySeeds.slice(0, 2)) {
      queries.push(`best ${seed}`);
    }
    queries.push(`brands like ${signals.title.split(/[|–—\-:]/)[0]?.trim() || signals.domain}`);

    for (const svc of signals.serviceKeywords.slice(0, 2)) {
      queries.push(`buy ${svc} online`);
    }
  } else {
    for (const seed of querySeeds.slice(0, 3)) {
      queries.push(`${seed} companies`);
      queries.push(`best ${seed}`);
    }
    queries.push(`top ${querySeeds[0]} services`);
    for (const svc of signals.serviceKeywords.slice(0, 3)) {
      queries.push(svc);
    }
  }

  // If we ended up with "general business" or very few queries, extract from actual site content
  if (industry === "general business" || queries.length < 4) {
    const desc = signals.metaDescription.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const h1Text = signals.h1s.map(h => h.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim()).filter(h => h.length > 5);
    const titleClean = signals.title.toLowerCase()
      .replace(/[|–—\-:]/g, " ").replace(signals.domain, "").replace(/\.com|\.net|\.org/gi, "").trim();
    
    // Use descriptive content as queries, with location if available
    const contentQueries = [titleClean, ...h1Text, desc].filter(q => q.length > 5 && q.length < 80);
    const loc = location ? ` ${location.city}` : "";
    for (const cq of contentQueries.slice(0, 4)) {
      queries.push(cq + loc);
    }
  }

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

// Industries that are ALWAYS local businesses regardless of ecom signals
const INHERENTLY_LOCAL = new Set([
  "med spa", "plastic surgery", "dermatology", "chiropractic", "physical therapy",
  "orthodontics", "dental", "optometry", "veterinary", "hair salon", "nail salon",
  "massage therapy", "day spa", "personal injury law", "criminal defense law",
  "family law", "immigration law", "legal", "plumbing", "hvac", "roofing",
  "electrical", "pest control", "landscaping", "cleaning", "moving", "auto repair",
  "auto dealership", "real estate", "restaurant", "construction", "fitness",
  "insurance", "accounting", "medical practice", "home services", "event planning",
]);

export function analyzeSite(signals: SiteSignals): SiteAnalysis {
  const businessName = extractBusinessName(signals);
  const { industry, querySeeds } = inferIndustry(signals);

  let businessType: "local" | "ecommerce" | "national" = "local";
  if (INHERENTLY_LOCAL.has(industry)) {
    businessType = "local"; // Always local, even if site has booking/cart
  } else if (signals.hasEcomSignals) {
    businessType = "ecommerce";
  } else if (!signals.city && !signals.state) {
    businessType = "national";
  }

  const location =
    signals.city && signals.state ? { city: signals.city, state: signals.state } : null;

  const primaryKeywords = [
    industry,
    ...signals.metaKeywords.slice(0, 5),
    ...signals.serviceKeywords.slice(0, 5),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const searchQueries = generateSearchQueries(signals, industry, querySeeds, location, businessType);

  return {
    businessName,
    businessType,
    industry,
    location,
    primaryKeywords,
    searchQueries,
  };
}
