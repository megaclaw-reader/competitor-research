export interface SiteSignals {
  url: string;
  domain: string;
  title: string;
  metaDescription: string;
  metaKeywords: string[];
  h1s: string[];
  h2s: string[];
  schemaData: Record<string, any>[];
  addressText: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  hasEcomSignals: boolean;
  serviceKeywords: string[];
  bodyText: string;
}

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

function extractTag(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const results: string[] = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, "").replace(/\\s+/g, " ").trim();
    if (text) results.push(text);
  }
  return results;
}

function extractMeta(html: string, name: string): string {
  const re = new RegExp(
    `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`,
    "i"
  );
  const m = re.exec(html);
  return m ? (m[1] || m[2] || "").trim() : "";
}

function extractSchemaJsonLd(html: string): Record<string, any>[] {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const schemas: Record<string, any>[] = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) schemas.push(...parsed);
      else schemas.push(parsed);
    } catch {}
  }
  return schemas;
}

function extractLocation(
  html: string,
  schemas: Record<string, any>[]
): { city: string | null; state: string | null; zip: string | null; addressText: string | null } {
  // Try schema first
  for (const s of schemas) {
    const addr = s.address || s.location?.address;
    if (addr) {
      return {
        city: addr.addressLocality || null,
        state: addr.addressRegion || null,
        zip: addr.postalCode || null,
        addressText: [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
          .filter(Boolean)
          .join(", "),
      };
    }
  }

  // Regex for US addresses
  const stateAbbrs = Object.keys(US_STATES).join("|");
  const addrRe = new RegExp(
    `([A-Z][a-zA-Z\\s]+),\\s*(${stateAbbrs})\\s*(\\d{5}(?:-\\d{4})?)`,
    "g"
  );
  const m = addrRe.exec(html.replace(/<[^>]+>/g, " "));
  if (m) {
    return { city: m[1].trim(), state: m[2], zip: m[3], addressText: m[0] };
  }

  // Try city, state without zip (case-insensitive for state)
  const cityStateRe = new RegExp(
    `([A-Z][a-zA-Z\\s]{2,20}),\\s*(${stateAbbrs})\\b`,
    "gi"
  );
  const m2 = cityStateRe.exec(html.replace(/<[^>]+>/g, " "));
  if (m2) {
    return { city: m2[1].trim(), state: m2[2].toUpperCase(), zip: null, addressText: m2[0] };
  }

  return { city: null, state: null, zip: null, addressText: null };
}

function detectEcom(html: string): boolean {
  const signals = [
    /add.to.cart/i, /shopping.cart/i, /checkout/i, /shopify/i,
    /woocommerce/i, /bigcommerce/i, /product-price/i, /buy.now/i,
    /"@type"\s*:\s*"Product"/i, /data-product/i, /cart-count/i,
    /shop\.app/i, /snipcart/i, /shopify\.com/i,
    /free.shipping/i, /add.to.bag/i, /shop.now/i, /shop.all/i,
    /product-card/i, /product-grid/i, /collection/i,
    /cart\.js/i, /\/cart\b/i, /\/collections\//i, /\/products\//i,
    /data-shopify/i, /cdn\.shopify/i,
  ];
  return signals.filter((r) => r.test(html)).length >= 2;
}

function extractServiceKeywords(text: string, title: string, desc: string): string[] {
  const combined = `${title} ${desc} ${text}`.toLowerCase();
  // Pull out phrases that look like services
  const words = combined
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Bigram extraction for service-like phrases
  const bigrams: Record<string, number> = {};
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`;
    bigrams[bg] = (bigrams[bg] || 0) + 1;
  }

  return Object.entries(bigrams)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([bg]) => bg);
}

export async function scrapeSite(url: string): Promise<SiteSignals> {
  const domain = new URL(url).hostname.replace(/^www\./, "");

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });

  const html = await res.text();
  const title = (extractTag(html, "title")[0] || "").slice(0, 200);
  const metaDescription = extractMeta(html, "description");
  const metaKeywordsRaw = extractMeta(html, "keywords");
  const metaKeywords = metaKeywordsRaw
    ? metaKeywordsRaw.split(",").map((k) => k.trim()).filter(Boolean)
    : [];
  const h1s = extractTag(html, "h1").slice(0, 5);
  const h2s = extractTag(html, "h2").slice(0, 10);
  const schemas = extractSchemaJsonLd(html);
  const location = extractLocation(html, schemas);
  const hasEcomSignals = detectEcom(html);
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 5000);

  const phoneRe = /(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/;
  const phoneMatch = phoneRe.exec(bodyText);

  const serviceKeywords = extractServiceKeywords(bodyText, title, metaDescription);

  return {
    url,
    domain,
    title,
    metaDescription,
    metaKeywords,
    h1s,
    h2s,
    schemaData: schemas,
    ...location,
    phone: phoneMatch ? phoneMatch[0] : null,
    hasEcomSignals,
    serviceKeywords,
    bodyText,
  };
}
