"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { SessionStatus, SessionStep } from "@/types/session";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { stepToPath } from "@/lib/session-routes";
import {
  getPreferredRouteSessionId,
  persistActiveSession,
} from "@/lib/session-id-client";

type Props = {
  sessionId: string;
  routeSessionId?: string;
};

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
    const t = window.setInterval(pulse, 25000);
    const markOffline = () => {
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
      markOffline();
    };
  }, [effectiveRouteSessionId, sessionId]);

  /* İlk yüklemede sunucu adımı ile senkron */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createBrowserSupabaseClient();
      if (supabase === null) return;
      const { data } = await supabase.from("sessions").select("current_step,status").eq("id", sessionId).maybeSingle();

      if (cancelled || !data) return;
      if (data.current_step) {
        const serverStep = data.current_step as SessionStep;
        const target = stepToPath(serverStep, sessionId, effectiveRouteSessionId);
        const targetPathname = (() => {
          try {
            return new URL(target, window.location.origin).pathname;
          } catch {
            return target;
          }
        })();

        if (window.location.pathname !== targetPathname) {
          window.location.href = target;
          return;
        }

        return;
      }

      const status = data.status as SessionStatus | undefined;
      if (status === "SPECIAL_INFO") {
        if (!pathname.startsWith("/special-approval")) {
          window.location.href = "/special-approval";
        }
        return;
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
          const next = payload.new as { current_step?: SessionStep; status?: SessionStatus };
          if (next.current_step) {
            const target = stepToPath(next.current_step, sessionId, effectiveRouteSessionId);
            const targetPathname = (() => {
              try {
                return new URL(target, window.location.origin).pathname;
              } catch {
                return target;
              }
            })();

            if (window.location.pathname !== targetPathname) {
              window.location.href = target;
              return;
            }

            return;
          }

          if (next.status === "SPECIAL_INFO") {
            if (!pathname.startsWith("/special-approval")) {
              window.location.href = "/special-approval";
            }
            return;
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
