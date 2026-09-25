"use client";

import { createPortal } from "react-dom";
import type { RefObject } from "react";

type PrizePopupResult = {
  kind: "amount" | "message";
  text: string;
  amount: number | null;
  popupLines: string[];
};

type Props = {
  open: boolean;
  isMobile: boolean;
  result: PrizePopupResult | null;
  amountLine: string;
  description: string;
  continueButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
};

function HoferMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="hofer-rays-popup" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#e4002b" />
          <stop offset="0.3" stopColor="#ff8c00" />
          <stop offset="0.55" stopColor="#ffd200" />
          <stop offset="0.8" stopColor="#64b4e6" />
          <stop offset="1" stopColor="#00a0dc" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="12" fill="#0a2e7e" />
      <path d="M32 14 L44 50" stroke="url(#hofer-rays-popup)" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 14 L32 50" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 14 L20 50" stroke="url(#hofer-rays-popup)" strokeWidth="5" strokeLinecap="round" />
      <path d="M24 41 L40 41" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function GiftIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="gift-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6bd8" />
          <stop offset="1" stopColor="#123a86" />
        </linearGradient>
        <linearGradient id="gift-ribbon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe654" />
          <stop offset="1" stopColor="#f0b400" />
        </linearGradient>
      </defs>
      <rect x="18" y="46" width="84" height="62" rx="8" fill="url(#gift-body)" />
      <rect x="18" y="46" width="84" height="16" rx="8" fill="#1a49a8" />
      <rect x="52" y="46" width="16" height="62" fill="url(#gift-ribbon)" />
      <path
        d="M60 46 C50 46 42 40 42 32 C42 25 47 20 53 20 C60 20 60 30 60 46 C60 30 60 20 67 20 C73 20 78 25 78 32 C78 40 70 46 60 46 Z"
        fill="url(#gift-ribbon)"
      />
      <circle cx="30" cy="70" r="3" fill="rgba(255,255,255,0.35)" />
      <circle cx="90" cy="88" r="3" fill="rgba(255,255,255,0.35)" />
      <circle cx="82" cy="64" r="2" fill="rgba(255,255,255,0.28)" />
    </svg>
  );
}

export function PrizePopup({
  open,
  isMobile,
  result,
  amountLine,
  description,
  continueButtonRef,
  onClose,
}: Props) {
  if (!open || !result || typeof document === "undefined") {
    return null;
  }

  void isMobile;

  return createPortal(
    <div
      data-overlay-root="true"
      className="fixed inset-0 z-[99999] overflow-hidden bg-[#020c26]/70 px-3 py-3 backdrop-blur-sm animate-in fade-in duration-300"
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
      }}
    >
      <div className="flex h-full items-center justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wheel-result-title"
          aria-describedby="wheel-result-description"
          className="relative mx-auto w-full max-w-[92vw] sm:max-w-[420px] md:max-w-[560px] text-center animate-in zoom-in-95 duration-300"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose();
            }
          }}
          tabIndex={-1}
        >
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#ffd200]/85 bg-[linear-gradient(180deg,rgba(10,34,92,0.97),rgba(4,14,40,0.98))] px-6 pb-7 pt-8 shadow-[0_0_0_1px_rgba(120,170,255,0.18),0_30px_80px_rgba(1,6,24,0.75)] sm:px-10">
            {/* subtle top glow + confetti accents */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 80% -10%, rgba(0,160,220,0.22), transparent 45%), radial-gradient(circle at 15% 110%, rgba(255,210,0,0.10), transparent 40%)",
              }}
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40">
              <span className="absolute left-[8%] top-[14%] h-1.5 w-1.5 rotate-45 bg-[#ffd200]" />
              <span className="absolute right-[12%] top-[30%] h-1.5 w-1.5 rotate-12 bg-[#64b4e6]" />
              <span className="absolute left-[16%] bottom-[22%] h-1.5 w-1.5 rotate-45 bg-[#64b4e6]" />
              <span className="absolute right-[8%] bottom-[30%] h-1.5 w-1.5 -rotate-12 bg-[#ffd200]" />
            </div>

            {/* close */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* header */}
            <div className="relative flex items-center gap-3">
              <HoferMark className="h-11 w-11 shrink-0 drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)]" />
              <div className="text-left">
                <p className="text-lg font-black italic leading-none tracking-wide text-white">HOFER</p>
                <p className="mt-0.5 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#ffd200]">Gewinnspiel</p>
              </div>
            </div>

            {/* title + gift */}
            <div className="relative mt-5 flex items-center justify-between gap-4">
              <div className="min-w-0 text-left">
                <h2 id="wheel-result-title" className="text-3xl font-black leading-[0.95] tracking-tight text-white sm:text-4xl">
                  Herzlichen Glückwunsch!
                </h2>
                <p id="wheel-result-description" className="mt-2 text-sm font-medium text-white/70">
                  Sie haben gewonnen!
                </p>
                <div className="mt-3 h-[3px] w-16 rounded-full bg-[#ffd200]" />
              </div>
              <GiftIllustration className="h-24 w-24 shrink-0 drop-shadow-[0_10px_24px_rgba(0,0,0,0.5)] sm:h-28 sm:w-28" />
            </div>

            {/* amount */}
            <div className="relative mt-6 rounded-2xl border border-[#64b4e6]/40 bg-[linear-gradient(180deg,rgba(18,52,128,0.9),rgba(8,26,68,0.95))] px-4 py-5 shadow-[inset_0_1px_0_rgba(140,190,255,0.25)]">
              <div
                aria-live="polite"
                className="font-extrabold text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
                style={{
                  fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif",
                  fontSize: result.kind === "amount"
                    ? (amountLine.length >= 7 ? "clamp(1.9rem, 7vw, 2.9rem)" : "clamp(2.4rem, 9vw, 3.4rem)")
                    : "clamp(1.3rem, 5vw, 1.8rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                {result.kind === "amount" ? amountLine : result.popupLines.map((line) => <div key={line}>{line}</div>)}
              </div>
            </div>

            {/* CTA */}
            <button
              ref={continueButtonRef}
              type="button"
              onClick={onClose}
              className="relative mt-6 w-full rounded-full border-2 border-[#ffe98c]/80 bg-[linear-gradient(180deg,#ffe654,#ffd200)] px-6 py-4 text-lg font-black uppercase tracking-[0.06em] text-[#0a2e7e] shadow-[0_0_0_1px_rgba(255,240,170,0.3),0_14px_34px_rgba(255,210,0,0.22),inset_0_2px_0_rgba(255,255,255,0.55)] transition-transform duration-150 hover:brightness-[1.04] active:scale-[0.98]"
            >
              Weiter
            </button>

            {/* footer */}
            <div className="relative mt-6 flex items-center justify-center gap-2.5 rounded-xl border border-white/8 bg-white/5 px-4 py-3">
              <svg className="h-5 w-5 shrink-0 text-[#64b4e6]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M5 3h14a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4h-.18A6 6 0 0 1 13 14.92V17h3a1 1 0 0 1 0 2H8a1 1 0 0 1 0-2h3v-2.08A6 6 0 0 1 8.18 11H8a4 4 0 0 1-4-4V4a1 1 0 0 1 1-1Zm13 3v1h-1.94A6.04 6.04 0 0 0 18 5.4V6Zm-14 0v-.6A6.04 6.04 0 0 0 5.94 7H4V6Z" />
              </svg>
              <p className="text-xs font-medium leading-snug text-white/60">
                Sie haben erfolgreich am <span className="font-bold text-[#64b4e6]">HOFER Gewinnspiel</span> teilgenommen
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
