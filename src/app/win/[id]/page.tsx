import { SessionRealtimeGate } from "@/components/demo/SessionRealtimeGate";
import { WinFlow } from "@/components/demo/WinFlow";
import { resolveServerSessionIdentity } from "@/lib/session-id";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WinPage({ params }: Props) {
  const { id } = await params;
  const { sessionId, routeSessionId } = await resolveServerSessionIdentity({
    routeSessionId: id,
  });

  return (
    <>
      <SessionRealtimeGate sessionId={sessionId} routeSessionId={routeSessionId} />
      <WinFlow sessionId={sessionId} />
    </>
  );
}
