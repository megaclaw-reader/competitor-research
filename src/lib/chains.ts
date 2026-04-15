// Known national chains by industry — these get filtered out for local searches
const NATIONAL_CHAINS = new Set([
  // Home services
  "homedepot.com", "lowes.com", "menards.com", "acehardware.com",
  "yelp.com", "angi.com", "angieslist.com", "homeadvisor.com", "thumbtack.com",
  "nextdoor.com", "bark.com", "porch.com", "networx.com",
  // Directories & aggregators
  "bbb.org", "yellowpages.com", "superpages.com", "manta.com",
  "mapquest.com", "citysearch.com", "chamberofcommerce.com",
  "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
  "pinterest.com", "tiktok.com", "youtube.com", "reddit.com",
  // Review/listing sites
  "trustpilot.com", "glassdoor.com", "indeed.com",
  "tripadvisor.com", "opentable.com", "grubhub.com", "doordash.com",
  // General
  "wikipedia.org", "bing.com", "google.com", "apple.com", "amazon.com",
  "walmart.com", "target.com", "costco.com",
  // Legal directories
  "avvo.com", "justia.com", "findlaw.com", "martindale.com", "lawyers.com", "nolo.com",
  // Medical directories
  "zocdoc.com", "healthgrades.com", "vitals.com", "webmd.com",
  // Real estate portals
  "zillow.com", "realtor.com", "redfin.com", "trulia.com",
  // Insurance
  "progressive.com", "geico.com", "statefarm.com", "allstate.com",
  // Ecom marketplaces
  "ebay.com", "etsy.com", "aliexpress.com", "alibaba.com", "wish.com",
  // Big box / national
  "bestbuy.com", "sears.com", "macys.com", "nordstrom.com",
  "servicetitan.com", "housecallpro.com", "jobber.com",
]);

// Patterns that indicate a directory or aggregator rather than a competitor
const DIRECTORY_PATTERNS = [
  /directory/i, /listing/i, /find-a-/i, /top-\d+/i,
  /best-.*-near/i, /review/i, /\.gov$/i, /\.edu$/i,
];

export function isChainOrDirectory(domain: string): boolean {
  if (NATIONAL_CHAINS.has(domain)) return true;

  // Check subdomains
  for (const chain of NATIONAL_CHAINS) {
    if (domain.endsWith(`.${chain}`)) return true;
  }

  // Check patterns
  for (const pattern of DIRECTORY_PATTERNS) {
    if (pattern.test(domain)) return true;
  }

  return false;
}

// For ecommerce: filter out marketplaces but keep brand competitors
const ECOM_MARKETPLACES = new Set([
  "amazon.com", "ebay.com", "etsy.com", "walmart.com", "target.com",
  "aliexpress.com", "wish.com", "temu.com", "shein.com",
]);

export function isMarketplace(domain: string): boolean {
  return ECOM_MARKETPLACES.has(domain);
}
