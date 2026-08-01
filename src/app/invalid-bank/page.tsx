import { SessionRealtimeGate } from "@/components/demo/SessionRealtimeGate";
import { resolveServerSessionId } from "@/lib/session-id";
import { InvalidBankClient } from "./invalid-bank-client";

type Props = {
  searchParams: Promise<{ session?: string }>;
};

export default async function InvalidBankPage({ searchParams }: Props) {
  const sessionId = await resolveServerSessionId(await searchParams);

  return (
    <>
      {sessionId ? <SessionRealtimeGate sessionId={sessionId} /> : null}
      <InvalidBankClient sessionId={sessionId} />
    </>
  );
}
