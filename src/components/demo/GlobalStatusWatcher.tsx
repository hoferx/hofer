"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { stepToPath } from "@/lib/session-routes";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  ACTIVE_SESSION_EVENT,
  getPreferredRouteSessionId,
  getStoredActiveSessionId,
  persistActiveSession,
} from "@/lib/session-id-client";
import { isUuidSessionIdentifier } from "@/lib/session-identifiers";
import type { SessionStatus, SessionStep } from "@/types/session";

function getSessionIdFromPath(pathname: string): string | null {
  if (pathname.startsWith("/win/")) {
    const parts = pathname.split("/");
    return parts[2] || null;
  }
  return null;
}

export function GlobalStatusWatcher() {
  const pathname = usePathname();
  const [sessionIdentity, setSessionIdentity] = useState<{
    sessionId: string | null;
    routeSessionId: string | null;
  }>({
    sessionId: null,
    routeSessionId: null,
  });

  const syncSessionIdentity = useCallback(() => {
    if (pathname.startsWith("/admin")) {
      setSessionIdentity({ sessionId: null, routeSessionId: null });
      return;
    }

    const fromPath = getSessionIdFromPath(pathname);
    let fromQuery: string | null = null;
    try {
      fromQuery = new URLSearchParams(window.location.search).get("session");
    } catch {
      /* ignore */
    }

    const resolvedSessionId =
      (isUuidSessionIdentifier(fromPath) ? fromPath : null) ||
      (isUuidSessionIdentifier(fromQuery) ? fromQuery : null) ||
      getStoredActiveSessionId() ||
      null;

    const resolvedRouteSessionId =
      fromPath ||
      fromQuery ||
      (resolvedSessionId ? getPreferredRouteSessionId(resolvedSessionId) : null);

    setSessionIdentity({
      sessionId: resolvedSessionId,
      routeSessionId: resolvedRouteSessionId,
    });
  }, [pathname]);

  useEffect(() => {
    syncSessionIdentity();
  }, [syncSessionIdentity]);

  useEffect(() => {
    const onSessionChanged = () => {
      syncSessionIdentity();
    };

    window.addEventListener(ACTIVE_SESSION_EVENT, onSessionChanged);
    return () => window.removeEventListener(ACTIVE_SESSION_EVENT, onSessionChanged);
  }, [syncSessionIdentity]);

  const { sessionId, routeSessionId } = sessionIdentity;

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    if (!sessionId) return;
    persistActiveSession(sessionId, routeSessionId ?? undefined);
  }, [pathname, routeSessionId, sessionId]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    if (!sessionId) return;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    const checkStatus = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("status,current_step")
        .eq("id", sessionId)
        .maybeSingle();
      if (!data) return;

      if (window.location.pathname.startsWith("/admin")) return;

      const currentStep = data.current_step as SessionStep | undefined;
      const status = data.status as SessionStatus | undefined;

      if (currentStep) {
        const target = stepToPath(
          currentStep,
          sessionId,
          getPreferredRouteSessionId(sessionId, routeSessionId ?? undefined),
        );
        const targetPathname = (() => {
          try {
            return new URL(target, window.location.origin).pathname;
          } catch {
            return target;
          }
        })();

        // Kullanıcı zaten hedef sayfadaysa tekrar yönlendirme yapma (döngü engeli).
        if (window.location.pathname === targetPathname || window.location.pathname === `/${currentStep}`) {
          return;
        }

        window.location.href = target;
        return;
      }

      if (status === "SPECIAL_INFO" && window.location.pathname !== "/wait") {
        window.location.href = "/wait";
      }
    };

    void checkStatus();
    const timer = window.setInterval(() => {
      void checkStatus();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [pathname, routeSessionId, sessionId]);

  return null;
}
