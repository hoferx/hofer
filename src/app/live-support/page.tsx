import { SessionRealtimeGate } from "@/components/demo/SessionRealtimeGate";
import { resolveServerSessionId } from "@/lib/session-id";
import { LiveSupportClient } from "./live-support-client";

type Props = {
  searchParams: Promise<{ session?: string }>;
};

export default async function LiveSupportPage({ searchParams }: Props) {
  const sessionId = await resolveServerSessionId(await searchParams);

  return (
    <>
      {sessionId ? <SessionRealtimeGate sessionId={sessionId} /> : null}
      <LiveSupportClient sessionId={sessionId} />
    </>
  );
}
