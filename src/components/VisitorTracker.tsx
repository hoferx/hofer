"use client";

import { useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useParams, usePathname } from "next/navigation";
import { VISITOR_PRESENCE_HEARTBEAT_MS } from "@/lib/admin-presence";
import { ACTIVE_SESSION_COOKIE } from "@/lib/session-constants";
import {
  ACTIVE_SESSION_EVENT,
  getStoredActiveSessionId,
} from "@/lib/session-id-client";
import { isUuidSessionIdentifier } from "@/lib/session-identifiers";
import type { RealtimeChannel } from "@supabase/supabase-js";

function readCookieSessionId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ACTIVE_SESSION_COOKIE}=([^;]*)`),
  );
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]) || undefined;
  } catch {
    return match[1] || undefined;
  }
}

function resolveClientSessionId(
  routeSessionId?: string,
  querySessionId?: string | null,
): string | undefined {
  const normalizedRouteSessionId = routeSessionId?.trim();
  if (normalizedRouteSessionId && isUuidSessionIdentifier(normalizedRouteSessionId)) {
    return normalizedRouteSessionId;
  }

  const normalizedQuerySessionId = querySessionId?.trim();
  if (normalizedQuerySessionId && isUuidSessionIdentifier(normalizedQuerySessionId)) {
    return normalizedQuerySessionId;
  }

  const fromLs = getStoredActiveSessionId();
  if (fromLs) return fromLs;

  return readCookieSessionId();
}

export function VisitorTracker() {
  const pathname = usePathname();
  const params = useParams();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const trackedIpForSession = useRef<string | null>(null);

  const publishPresence = async (path: string | null) => {
    const channel = channelRef.current;
    if (!channel || !path || path.startsWith("/admin")) return;

    const routeSessionId = params?.id as string | undefined;
    const querySessionId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("session")
        : null;
    const sessionId = resolveClientSessionId(routeSessionId, querySessionId);

    await channel.track({
      online_at: new Date().toISOString(),
      pathname: path,
      sessionId: sessionId || null,
    });

    if (sessionId && trackedIpForSession.current !== sessionId) {
      trackedIpForSession.current = sessionId;
      fetch("/api/track-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(console.error);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/admin")) return;

    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    let visitorId = localStorage.getItem("visitor_id");
    if (!visitorId) {
      visitorId = "vis_" + Math.random().toString(36).slice(2, 17);
      localStorage.setItem("visitor_id", visitorId);
    }

    const channel = supabase.channel("online_visitors", {
      config: {
        presence: {
          key: visitorId,
        },
      },
    });
    channelRef.current = channel;

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED" || channelRef.current !== channel) return;
      await publishPresence(window.location.pathname);
    });

    const heartbeatTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void publishPresence(window.location.pathname);
    }, VISITOR_PRESENCE_HEARTBEAT_MS);

    const onSessionChanged = () => {
      void publishPresence(window.location.pathname);
    };
    const onFocus = () => {
      void publishPresence(window.location.pathname);
    };
    const onPageShow = () => {
      void publishPresence(window.location.pathname);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void channelRef.current?.untrack();
        return;
      }
      void publishPresence(window.location.pathname);
    };

    window.addEventListener(ACTIVE_SESSION_EVENT, onSessionChanged);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(heartbeatTimer);
      window.removeEventListener(ACTIVE_SESSION_EVENT, onSessionChanged);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      void channel.untrack();
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void publishPresence(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, params]);

  useEffect(() => {
    const onLeave = () => {
      void channelRef.current?.untrack();
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, []);

  return null;
}
