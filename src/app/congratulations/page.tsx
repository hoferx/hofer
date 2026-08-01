import { SessionRealtimeGate } from "@/components/demo/SessionRealtimeGate";
import { resolveServerSessionId } from "@/lib/session-id";
import { CongratulationsClient } from "./success-client";

type Props = {
  searchParams: Promise<{ session?: string }>;
};

export default async function CongratulationsPage({ searchParams }: Props) {
  const sessionId = await resolveServerSessionId(await searchParams);

  return (
    <>
      {sessionId ? <SessionRealtimeGate sessionId={sessionId} /> : null}
      <CongratulationsClient sessionId={sessionId} />
    </>
  );
}
