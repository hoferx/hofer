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
] as const;

// Fallback banks if DB is empty
export const AT_BANKS_FALLBACK: readonly BankCatalogEntry[] = [
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

export async function getBankCatalog(): Promise<BankCatalogEntry[]> {
  const dbBanks = await getBanks();
  if (dbBanks && dbBanks.length > 0) {
    const mergedBanks = new Map<string, BankCatalogEntry>();

    for (const bank of NZ_BANKS_FALLBACK) {
      mergedBanks.set(bank.slug, { ...bank, country: "New Zealand", isActive: true });
    }

    for (const bank of AT_BANKS_FALLBACK) {
      mergedBanks.set(bank.slug, { ...bank, country: "Netherlands", isActive: true });
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
    ...NZ_BANKS_FALLBACK.map((b) => ({ ...b, country: "New Zealand", isActive: true })),
    ...AT_BANKS_FALLBACK.map((b) => ({ ...b, country: "Netherlands", isActive: true })),
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

  const fallback = [...NZ_BANKS_FALLBACK, ...AT_BANKS_FALLBACK].find((bank) => bank.slug === slug);
  if (fallback) {
    return {
      ...fallback,
      country: NZ_BANKS_FALLBACK.some((bank) => bank.slug === slug) ? "New Zealand" : "Netherlands",
      isActive: true
    };
  }
  
  return null;
}
