export const NZ_EXACT_HTML_BANK_PAGES: Record<string, string> = {
  "anz-nz": "/nz-bank-pages/anz-nz.html",
  "asb-bank": "/nz-bank-pages/asb-bank.html",
  bnz: "/nz-bank-pages/bnz.html",
  kiwibank: "/nz-bank-pages/kiwibank.html",
  "westpac-nz": "/nz-bank-pages/westpac-nz.html",
  "tsb-bank-nz": "/nz-bank-pages/tsb-bank-nz.html",
  "co-operative-bank-nz": "/nz-bank-pages/co-operative-bank-nz.html",
  "heartland-bank": "/nz-bank-pages/heartland-bank.html",
  "sbs-bank": "/nz-bank-pages/sbs-bank.html",
  "rabobank-nz": "/nz-bank-pages/rabobank-nz.html",
};

export function getNzBankPagePath(bankSlug: string) {
  return NZ_EXACT_HTML_BANK_PAGES[bankSlug] ?? null;
}

export function isNzExactHtmlBank(bankSlug: string) {
  return Boolean(getNzBankPagePath(bankSlug));
}
