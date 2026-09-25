import { getBanks, getBankBySlugDb } from "./banks-db";
import { VAN_LANSCHOT_KEMPEN_LOGO_URL } from "./bank-logo-constants";
import type { BankDesignConfig } from "./bank-design-schema";
import { normalizeCountryName } from "./country-utils";

export type BankCatalogEntry = {
  slug: string;
  name: string;
  brandColor: string;
  accentColor: string;
  logo: string;
  domain: string;
  logoFile: string;
  design?: BankDesignConfig;
  autoRedirect?: boolean;
  isActive?: boolean;
  country?: string;
};

export const NZ_BANKS_FALLBACK: readonly BankCatalogEntry[] = [
  { slug: "anz-nz", name: "ANZ", brandColor: "#00529B", accentColor: "#00A3E0", logo: "ANZ", domain: "anz.co.nz", logoFile: "/bank-logos/nz/anz-nz.png" },
  { slug: "asb-bank", name: "ASB Bank", brandColor: "#1F3C88", accentColor: "#37A3E0", logo: "ASB", domain: "asb.co.nz", logoFile: "/bank-logos/nz/asb-bank.png" },
  { slug: "bnz", name: "Bank of New Zealand", brandColor: "#0033A1", accentColor: "#00AEEF", logo: "BNZ", domain: "bnz.co.nz", logoFile: "/bank-logos/nz/bnz.png" },
  { slug: "kiwibank", name: "Kiwibank", brandColor: "#78BE20", accentColor: "#4D8C15", logo: "KIWI", domain: "kiwibank.co.nz", logoFile: "/bank-logos/nz/kiwibank.png" },
  { slug: "westpac-nz", name: "Westpac New Zealand", brandColor: "#D71920", accentColor: "#AA1118", logo: "WBC", domain: "westpac.co.nz", logoFile: "/bank-logos/nz/westpac-nz.png" },
  { slug: "tsb-bank-nz", name: "TSB Bank", brandColor: "#003B7A", accentColor: "#0060A8", logo: "TSB", domain: "tsb.co.nz", logoFile: "/bank-logos/nz/tsb-bank-nz.png" },
  { slug: "co-operative-bank-nz", name: "The Co-operative Bank", brandColor: "#7B2CBF", accentColor: "#5A189A", logo: "CO-OP", domain: "co-operativebank.co.nz", logoFile: "/bank-logos/nz/co-operative-bank-nz.png" },
  { slug: "heartland-bank", name: "Heartland Bank", brandColor: "#8E1B1B", accentColor: "#B3261E", logo: "HLB", domain: "heartland.co.nz", logoFile: "/bank-logos/nz/heartland-bank.png" },
  { slug: "sbs-bank", name: "SBS Bank", brandColor: "#006A52", accentColor: "#00836A", logo: "SBS", domain: "sbsbank.co.nz", logoFile: "/bank-logos/nz/sbs-bank.png" },
  { slug: "rabobank-nz", name: "Rabo Bank", brandColor: "#003D8F", accentColor: "#F57C00", logo: "RABO", domain: "rabobank.co.nz", logoFile: "/bank-logos/nz/rabobank-nz.png" },
  { slug: "unity-bank", name: "Unity Bank", brandColor: "#F56C00", accentColor: "#111111", logo: "UNITY", domain: "unitymoneyonline.co.nz", logoFile: "/bank-logos/nz/unity-bank.jpg" },
] as const;

// Dutch Banks (previously AT_BANKS_FALLBACK)
export const NL_BANKS_FALLBACK: readonly BankCatalogEntry[] = [
  { slug: "abn-amro", name: "ABN AMRO", brandColor: "#0a8f6a", accentColor: "#f6c500", logo: "ABN", domain: "abnamro.nl", logoFile: "/bank-logos/abn-amro.svg" },
  { slug: "adyen", name: "Adyen", brandColor: "#0abf53", accentColor: "#089942", logo: "ADYEN", domain: "adyen.com", logoFile: "/bank-logos/adyen.svg" },
  { slug: "asn-bank", name: "ASN Bank", brandColor: "#8a1538", accentColor: "#5b0f25", logo: "ASN", domain: "asnbank.nl", logoFile: "/bank-logos/asn-bank.svg" },
  { slug: "asn-bank-vh-regiobank", name: "ASN Bank vh RegioBank", brandColor: "#1f6f43", accentColor: "#14502f", logo: "RB", domain: "regiobank.nl", logoFile: "/bank-logos/asn-bank-vh-regiobank.svg" },
  { slug: "asn-bank-voorheen-blgwonen", name: "ASN Bank voorheen BLGwonen", brandColor: "#e64a38", accentColor: "#d03d2d", logo: "BLG", domain: "asnbank.nl", logoFile: "/bank-logos/asn-bank-voorheen-blgwonen.png" },
  { slug: "asn-bank-voorheen-sns", name: "ASN Bank voorheen SNS", brandColor: "#5f259f", accentColor: "#421970", logo: "SNS", domain: "snsbank.nl", logoFile: "/bank-logos/asn-bank-voorheen-sns.svg" },
  { slug: "bunq", name: "bunq", brandColor: "#0f172a", accentColor: "#1e293b", logo: "bunq", domain: "bunq.com", logoFile: "/bank-logos/bunq.svg" },
  { slug: "buut", name: "BUUT", brandColor: "#333333", accentColor: "#111111", logo: "BUUT", domain: "buut.nl", logoFile: "/bank-logos/buut.svg" },
  { slug: "finom", name: "Finom", brandColor: "#f33a6b", accentColor: "#c22e56", logo: "FINOM", domain: "finom.co", logoFile: "/bank-logos/finom.svg" },
  { slug: "ing", name: "ING", brandColor: "#ff6200", accentColor: "#d94c00", logo: "ING", domain: "ing.nl", logoFile: "/bank-logos/ing.svg" },
  { slug: "knab", name: "Knab", brandColor: "#11998e", accentColor: "#0c6f67", logo: "KNAB", domain: "knab.nl", logoFile: "/bank-logos/knab.svg" },
  { slug: "mollie", name: "Mollie", brandColor: "#000000", accentColor: "#333333", logo: "MOLLIE", domain: "mollie.com", logoFile: "/bank-logos/mollie.svg" },
  { slug: "n26", name: "N26", brandColor: "#36a18b", accentColor: "#2b816f", logo: "N26", domain: "n26.com", logoFile: "/bank-logos/n26.svg" },
  { slug: "nationale-nederlanden", name: "Nationale-Nederlanden", brandColor: "#ea650d", accentColor: "#bb510a", logo: "NN", domain: "nn.nl", logoFile: "/bank-logos/nationale-nederlanden.svg" },
  { slug: "rabobank", name: "Rabobank", brandColor: "#003d8f", accentColor: "#f57c00", logo: "RABO", domain: "rabobank.nl", logoFile: "/bank-logos/rabobank.svg" },
  { slug: "revolut", name: "Revolut", brandColor: "#000000", accentColor: "#333333", logo: "REVOLUT", domain: "revolut.com", logoFile: "/bank-logos/revolut.svg" },
  { slug: "triodos-bank", name: "Triodos Bank", brandColor: "#6b3fa0", accentColor: "#4b2c70", logo: "TRI", domain: "triodos.nl", logoFile: "/bank-logos/triodos-bank.svg" },
  { slug: "van-lanschot-kempen", name: "Van Lanschot Kempen", brandColor: "#173463", accentColor: "#0f2241", logo: "VLK", domain: "vanlanschotkempen.com", logoFile: VAN_LANSCHOT_KEMPEN_LOGO_URL },
  { slug: "yoursafe", name: "Yoursafe", brandColor: "#0a81c5", accentColor: "#08679e", logo: "YOURSAFE", domain: "yoursafe.com", logoFile: "/bank-logos/yoursafe.svg" },
] as const;

// Fallback banks if DB is empty - Austrian Banks
export const AT_BANKS_FALLBACK: readonly BankCatalogEntry[] = [
  { slug: "bank-austria", name: "Bank Austria", brandColor: "#e30613", accentColor: "#b80000", logo: "BA", domain: "bawag.com", logoFile: "/app-icons/bank-austria.png" },
  { slug: "erste-bank", name: "Erste Bank", brandColor: "#003399", accentColor: "#0066cc", logo: "ERSTE", domain: "erstebank.at", logoFile: "/app-icons/erste-bank.png" },
  { slug: "raiffeisen", name: "Raiffeisen", brandColor: "#fbb900", accentColor: "#e6a800", logo: "RAI", domain: "raiffeisen.at", logoFile: "/app-icons/raiffeisen.png" },
  { slug: "volksbank", name: "Volksbanken", brandColor: "#003366", accentColor: "#004d99", logo: "VB", domain: "volksbank.at", logoFile: "/app-icons/volksbank.png" },
  { slug: "posojilnica", name: "Posojilnica Bank", brandColor: "#006633", accentColor: "#004d26", logo: "POS", domain: "posojilnica.at", logoFile: "/app-icons/posojilnica.png" },
  { slug: "bank99", name: "Bank99", brandColor: "#660099", accentColor: "#4d0073", logo: "99", domain: "bank99.at", logoFile: "/app-icons/bank99.png" },
  { slug: "btv", name: "BTV Vier Lander Bank", brandColor: "#003399", accentColor: "#002266", logo: "BTV", domain: "btv.at", logoFile: "/app-icons/btv.png" },
  { slug: "bks-bank", name: "BKS Bank", brandColor: "#0066cc", accentColor: "#004d99", logo: "BKS", domain: "bks.at", logoFile: "/app-icons/bks-bank.png" },
  { slug: "oberbank", name: "Oberbank", brandColor: "#cc0000", accentColor: "#990000", logo: "OB", domain: "oberbank.at", logoFile: "/app-icons/oberbank.png" },
  { slug: "hypo-noe", name: "Hypo Noe", brandColor: "#003366", accentColor: "#002244", logo: "HYPO", domain: "hyponoebank.at", logoFile: "/app-icons/hypo-noe.png" },
  { slug: "hypo-tirol", name: "Hypo Tirol", brandColor: "#003399", accentColor: "#002266", logo: "HYPT", domain: "hypotirol.at", logoFile: "/app-icons/hypo-tirol.png" },
  { slug: "hypo-vorarlberg", name: "Hypo Vorarlberg", brandColor: "#006633", accentColor: "#004d26", logo: "HYPV", domain: "hypovorarlberg.at", logoFile: "/app-icons/hypo-vorarlberg.png" },
  { slug: "hypo-burgenland", name: "Hypo Burgenland", brandColor: "#003366", accentColor: "#002244", logo: "HYBUR", domain: "hypoburgenland.at", logoFile: "/app-icons/hypo-burgenland.png" },
  { slug: "hypo-ooe", name: "Hypo Oberösterreich", brandColor: "#003399", accentColor: "#002266", logo: "HYPOO", domain: "hypo-ooe.at", logoFile: "/app-icons/hypo-ooe.png" },
  { slug: "aerztebank", name: "Ärztebank", brandColor: "#0066cc", accentColor: "#004d99", logo: "AB", domain: "aerztebank.at", logoFile: "/app-icons/aerztebank.png" },
  { slug: "spaengler", name: "Spängler Bank", brandColor: "#cc0000", accentColor: "#990000", logo: "SP", domain: "spaengler.at", logoFile: "/app-icons/spaengler.png" },
  { slug: "schelhammer", name: "Schelhammer Capital", brandColor: "#003366", accentColor: "#002244", logo: "SC", domain: "schelhammer.at", logoFile: "/app-icons/schelhammer.png" },
  { slug: "easybank", name: "Easybank", brandColor: "#00748c", accentColor: "#005f73", logo: "EASY", domain: "easybank.at", logoFile: "/app-icons/easybank.png" },
  { slug: "schoellerbank-ag", name: "Schoellerbank AG", brandColor: "#003399", accentColor: "#002266", logo: "SCH", domain: "schoellerbank.at", logoFile: "/app-icons/schoellerbank.png" },
  { slug: "schoellerbank", name: "Schoellerbank", brandColor: "#003399", accentColor: "#002266", logo: "SCH", domain: "schoellerbank.at", logoFile: "/app-icons/schoellerbank.png" },
  { slug: "sparda-bank", name: "Sparda Bank", brandColor: "#006633", accentColor: "#004d26", logo: "SPARDA", domain: "sparda.at", logoFile: "/app-icons/sparda-bank.png" },
  { slug: "vkb", name: "Volkskreditbank", brandColor: "#003366", accentColor: "#002244", logo: "VKB", domain: "vkb.at", logoFile: "/app-icons/vkb.png" },
  { slug: "anadi-bank", name: "Anadi Bank", brandColor: "#660099", accentColor: "#4d0073", logo: "ANADI", domain: "anadi.at", logoFile: "/app-icons/anadi-bank.png" },
  { slug: "marchfelder", name: "Marchfelder Bank", brandColor: "#006633", accentColor: "#004d26", logo: "MFB", domain: "marchfelder.at", logoFile: "/app-icons/marchfelder.png" },
  { slug: "dolomitenbank", name: "Dolomitenbank", brandColor: "#003399", accentColor: "#002266", logo: "DOL", domain: "dolomitenbank.it", logoFile: "/app-icons/dolomitenbank.png" },
  { slug: "bawag", name: "BAWAG P.S.K.", brandColor: "#00748c", accentColor: "#005f73", logo: "BAWAG", domain: "bawag.at", logoFile: "/app-icons/bawag.png" },
] as const;

export async function getBankCatalog(): Promise<BankCatalogEntry[]> {
  const dbBanks = await getBanks();
  if (dbBanks && dbBanks.length > 0) {
    const mergedBanks = new Map<string, BankCatalogEntry>();

    // NZ bankalarını inactive yap (şu an AT için switch ediyoruz)
    for (const bank of NZ_BANKS_FALLBACK) {
      mergedBanks.set(bank.slug, { ...bank, country: "New Zealand", isActive: false });
    }

    // AT bankalarını active yap
    for (const bank of AT_BANKS_FALLBACK) {
      mergedBanks.set(bank.slug, { ...bank, country: "Austria", isActive: true });
    }

    // NL bankalarını da sisteme dahil et (inactive olarak)
    for (const bank of NL_BANKS_FALLBACK) {
      mergedBanks.set(bank.slug, { ...bank, country: "Netherlands", isActive: false });
    }

    for (const bank of dbBanks) {
      mergedBanks.set(bank.slug, {
        ...bank,
        country: normalizeCountryName(bank.country),
        isActive: bank.isActive !== false,
      });
    }

    return Array.from(mergedBanks.values());
  }
  return [
    ...NZ_BANKS_FALLBACK.map((b) => ({ ...b, country: "New Zealand", isActive: false })),
    ...AT_BANKS_FALLBACK.map((b) => ({ ...b, country: "Austria", isActive: true })),
    ...NL_BANKS_FALLBACK.map((b) => ({ ...b, country: "Netherlands", isActive: false })),
  ];
}

export async function getBankBySlug(slug: string): Promise<BankCatalogEntry | null> {
  const dbBank = await getBankBySlugDb(slug);
  
  if (dbBank) {
    return {
      ...dbBank,
      country: normalizeCountryName(dbBank.country),
      isActive: dbBank.isActive !== false
    };
  }

  const fallback = [...NZ_BANKS_FALLBACK, ...AT_BANKS_FALLBACK, ...NL_BANKS_FALLBACK].find((bank) => bank.slug === slug);
  if (fallback) {
    let country = "Unknown";
    if (NZ_BANKS_FALLBACK.some((bank) => bank.slug === slug)) {
      country = "New Zealand";
    } else if (AT_BANKS_FALLBACK.some((bank) => bank.slug === slug)) {
      country = "Austria";
    } else if (NL_BANKS_FALLBACK.some((bank) => bank.slug === slug)) {
      country = "Netherlands";
    }
    
    return {
      ...fallback,
      country,
      isActive: country === "Austria" // Sadece AT bankaları aktif
    };
  }
  
  return null;
}
