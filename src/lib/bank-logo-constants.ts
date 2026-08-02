export const VAN_LANSCHOT_KEMPEN_LOGO_URL = "/bank-logos/van-lanschot-kempen.svg";

export const LOCAL_BANK_LOGO_BY_SLUG: Record<string, string> = {
  "anz-nz": "/bank-logos/nz/anz-nz.png",
  "asb-bank": "/bank-logos/nz/asb-bank.png",
  "bigbank": "/bank-logos/estonia/bigbank.jpg",
  "bnz": "/bank-logos/nz/bnz.png",
  "co-operative-bank-nz": "/bank-logos/nz/co-operative-bank-nz.png",
  "citadele-banka": "/bank-logos/estonia/citadele-banka.jpg",
  "coop-pank": "/bank-logos/estonia/coop-pank.jpg",
  "heartland-bank": "/bank-logos/nz/heartland-bank.png",
  "inbank": "/bank-logos/estonia/inbank.png",
  "kiwibank": "/bank-logos/nz/kiwibank.png",
  "lhv-pank": "/bank-logos/estonia/lhv-pank.jpg",
  "luminor-ee": "/bank-logos/estonia/luminor-ee.jpg",
  "op-corporate-bank": "/bank-logos/estonia/op-corporate-bank.jpg",
  "rabobank-nz": "/bank-logos/nz/rabobank-nz.png",
  "sbs-bank": "/bank-logos/nz/sbs-bank.png",
  "seb-pank": "/bank-logos/estonia/seb-pank.jpg",
  "swedbank-ee": "/bank-logos/estonia/swedbank-ee.jpg",
  "tsb-bank-nz": "/bank-logos/nz/tsb-bank-nz.png",
  "van-lanschot-kempen": VAN_LANSCHOT_KEMPEN_LOGO_URL,
  "westpac-nz": "/bank-logos/nz/westpac-nz.png",
};

export function resolveLocalBankLogoFile(slug?: string | null, logoFile?: string | null) {
  const normalizedLogoFile = typeof logoFile === "string" ? logoFile.trim() : "";

  if (normalizedLogoFile.startsWith("/")) {
    return normalizedLogoFile;
  }

  if (slug) {
    const localLogo = LOCAL_BANK_LOGO_BY_SLUG[slug];
    if (localLogo) {
      return localLogo;
    }
  }

  return normalizedLogoFile;
}
