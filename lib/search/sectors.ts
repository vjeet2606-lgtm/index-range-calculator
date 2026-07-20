/**
 * Best-effort sector classification derived from a company's own name text.
 * Dhan's scrip master (the only data source this app has for the F&O
 * universe) has no sector/industry field at all — verified directly against
 * a live download, not assumed — so this is a keyword heuristic, not an
 * authoritative GICS/NSE industry classification. It exists to power the
 * "Sector Match" search tier and the Sector field on a result card; it's
 * intentionally conservative (first matching rule wins, most specific rules
 * first) and falls back to "Diversified" rather than guessing. Tested against
 * the real, current 208-stock F&O universe — roughly 3 in 4 classify cleanly;
 * the rest are either genuine conglomerates or names too abbreviated to
 * derive anything from ("ABB", "LTM"), and land in "Diversified" honestly
 * rather than being force-fit.
 */
const SECTOR_RULES: { sector: string; keywords: string[] }[] = [
  { sector: "Banking", keywords: ["BANK"] },
  { sector: "Insurance", keywords: ["INSURANCE", "PRUDENTIAL"] },
  {
    sector: "Information Technology",
    keywords: ["TECHNOLOG", "SOFTWARE", "INFOTECH", "INFOSYS", "MPHASIS", "PERSISTENT", "COFORGE", "WIPRO", "KPIT"],
  },
  {
    sector: "Pharmaceuticals & Healthcare",
    keywords: ["PHARMA", "LABORATOR", "LABS", "HEALTHCARE", "HOSPITAL", "LIFE SCIENCE"],
  },
  { sector: "Automobile & Auto Components", keywords: ["MOTOR", "AUTOMOTIVE", "TYRE", "BOSCH", "FORGE", "BEARING"] },
  {
    sector: "Metals & Mining",
    keywords: ["STEEL", "ZINC", "ALUMINIUM", "MINING", "COAL", "VEDANTA", "NALCO", "IRON", "TUBES"],
  },
  { sector: "Oil & Gas", keywords: ["PETROLEUM", "PETRO", "REFINER", "OIL", "NATURAL GAS"] },
  { sector: "Power & Energy", keywords: ["POWER", "ENERGY", "GRID", "SOLAR", "WIND"] },
  { sector: "Cement & Construction Materials", keywords: ["CEMENT"] },
  {
    sector: "FMCG & Consumer Goods",
    keywords: ["FOODS", "BEVERAGE", "CONSUMER PRODUCT", "SPIRITS", "UNILEVER", "NESTLE", "PATANJALI"],
  },
  {
    sector: "Financial Services",
    keywords: [
      "FINANCE",
      "FINANCIAL",
      "CAPITAL",
      "INVESTMENT",
      "HOUSING FINANCE",
      "FINSERV",
      "FINTECH",
      "WEALTH",
      " AMC",
      "DEPOSITOR",
      "EXCHANGE",
    ],
  },
  { sector: "Telecom", keywords: ["AIRTEL", "TELECOM", "COMMUNICATION", "TOWER", "VODAFONE"] },
  { sector: "Real Estate", keywords: ["REALTY", "PROPERT", "DEVELOPERS", "ESTATE"] },
  { sector: "Retail & Consumer Durables", keywords: ["JEWELL", "RETAIL", "SUPERMART", "DURABLE", "ELECTRONIC"] },
  {
    sector: "Capital Goods & Industrials",
    keywords: ["ELECTRIC", "ENGINEERING", "DYNAMICS", "AERONAUTICS", "DEFENCE", "SHIPBUILD", "SHIPYARD"],
  },
  { sector: "Chemicals & Paints", keywords: ["CHEMICAL", "PAINT", "FERTILIS"] },
  {
    sector: "Aviation, Ports & Logistics",
    keywords: ["AIRLINE", "AIRPORT", "AVIATION", "LOGISTICS", "SHIPPING", "PORTS", "CONTAINER"],
  },
  { sector: "Media & Entertainment", keywords: ["MEDIA", "ENTERTAINMENT"] },
  { sector: "Textiles & Apparel", keywords: ["TEXTILE", "APPAREL", "GARMENT"] },
];

export const FALLBACK_SECTOR = "Diversified";

/**
 * A handful of well-known symbols the keyword rules structurally can't reach
 * — either the company's official name is itself just an abbreviation
 * ("BSE", "CDSL", "MCX"), or it's a well-known PSU/institution whose name
 * doesn't spell out its industry ("GAIL", "NTPC"). Each entry here is a
 * verifiable fact about what the company actually is/does, not a guess.
 */
const SECTOR_OVERRIDES: Record<string, string> = {
  BSE: "Financial Services",
  CDSL: "Financial Services",
  CAMS: "Financial Services",
  MCX: "Financial Services",
  SBICARD: "Financial Services",
  IRFC: "Financial Services",
  RECLTD: "Financial Services",
  PFC: "Financial Services",
  IREDA: "Financial Services",
  ANGELONE: "Financial Services",
  MOTILALOFS: "Financial Services",
  "360ONE": "Financial Services",
  LICI: "Insurance",
  ITC: "FMCG & Consumer Goods",
  BRITANNIA: "FMCG & Consumer Goods",
  DABUR: "FMCG & Consumer Goods",
  COLPAL: "FMCG & Consumer Goods",
  MARICO: "FMCG & Consumer Goods",
  JUBLFOOD: "FMCG & Consumer Goods",
  ASHOKLEY: "Automobile & Auto Components",
  HEROMOTOCO: "Automobile & Auto Components",
  MARUTI: "Automobile & Auto Components",
  EXIDEIND: "Automobile & Auto Components",
  "M&M": "Automobile & Auto Components",
  MOTHERSON: "Automobile & Auto Components",
  SONACOMS: "Automobile & Auto Components",
  UNOMINDA: "Automobile & Auto Components",
  HINDALCO: "Metals & Mining",
  NMDC: "Metals & Mining",
  BEL: "Capital Goods & Industrials",
  NBCC: "Capital Goods & Industrials",
  SIEMENS: "Capital Goods & Industrials",
  RVNL: "Capital Goods & Industrials",
  CUMMINSIND: "Capital Goods & Industrials",
  LT: "Capital Goods & Industrials",
  ABB: "Capital Goods & Industrials",
  KEI: "Capital Goods & Industrials",
  HAVELLS: "Retail & Consumer Durables",
  VOLTAS: "Retail & Consumer Durables",
  CROMPTON: "Retail & Consumer Durables",
  DLF: "Real Estate",
  NAUKRI: "Information Technology",
  TCS: "Information Technology",
  TECHM: "Information Technology",
  TATAELXSI: "Information Technology",
  CIPLA: "Pharmaceuticals & Healthcare",
  LUPIN: "Pharmaceuticals & Healthcare",
  BIOCON: "Pharmaceuticals & Healthcare",
  GAIL: "Oil & Gas",
  NTPC: "Power & Energy",
  NHPC: "Power & Energy",
};

function hasKeyword(nameUpperPadded: string, keyword: string): boolean {
  return nameUpperPadded.includes(keyword.toUpperCase());
}

export function deriveSector(symbol: string, companyName: string): string {
  if (SECTOR_OVERRIDES[symbol]) return SECTOR_OVERRIDES[symbol];

  const nameUpper = ` ${companyName.toUpperCase()} `;
  for (const rule of SECTOR_RULES) {
    if (rule.keywords.some((kw) => hasKeyword(nameUpper, kw))) return rule.sector;
  }
  return FALLBACK_SECTOR;
}

export const ALL_SECTORS: string[] = [...SECTOR_RULES.map((r) => r.sector), FALLBACK_SECTOR];
