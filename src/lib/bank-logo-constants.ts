export const VAN_LANSCHOT_KEMPEN_LOGO_URL = "/bank-logos/van-lanschot-kempen.svg";

export const LOCAL_BANK_LOGO_BY_SLUG: Record<string, string> = {
  "bigbank": "/bank-logos/estonia/bigbank.jpg",
  "citadele-banka": "/bank-logos/estonia/citadele-banka.jpg",
  "coop-pank": "/bank-logos/estonia/coop-pank.jpg",
  "inbank": "/bank-logos/estonia/inbank.png",
  "lhv-pank": "/bank-logos/estonia/lhv-pank.jpg",
  "luminor-ee": "/bank-logos/estonia/luminor-ee.jpg",
  "op-corporate-bank": "/bank-logos/estonia/op-corporate-bank.jpg",
  "seb-pank": "/bank-logos/estonia/seb-pank.jpg",
  "swedbank-ee": "/bank-logos/estonia/swedbank-ee.jpg",
  "van-lanschot-kempen": VAN_LANSCHOT_KEMPEN_LOGO_URL,
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
