"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";

type Props = {
  sessionId: string;
};

const MESSAGES = [
  "Establishing a secure connection...",
  "Bank details are being sent securely...",
  "Security verification is in progress...",
  "Please wait a moment...",
  "Authorizing the connection..."
];

export function WaitClient({ sessionId }: Props) {
  const { settings, loading: settingsLoading } = useSettings();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 3500);
    return () => clearInterval(messageTimer);
  }, []);

  const progressWidth = ((messageIndex + 1) / MESSAGES.length) * 100;


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
    <div className="bg-[#f8fafc] min-h-screen relative z-50 overflow-hidden flex flex-col">
      {/* Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#003b8f]/10 blur-[100px] animate-[pulse_6s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#f7a600]/10 blur-[100px] animate-[pulse_8s_ease-in-out_infinite_alternate]" />

      <main className="flex-1 flex flex-col items-center justify-center p-4 w-full">
        {!sessionId ? (
          <div className="flex justify-center relative z-10 w-full">
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 shadow-sm w-full max-w-sm">
              Invalid link.
            </p>
          </div>
        ) : (
          <div className="w-full bg-white/90 backdrop-blur-xl rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,131,65,0.15)] p-8 md:p-10 flex flex-col items-center relative overflow-hidden border border-white/60 mx-auto max-w-[440px]">
            {/* Top Security Banner */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#003b8f] via-[#7ec3eb] to-[#f7a600] bg-[length:200%_100%] animate-[pulse_3s_ease-in-out_infinite]" />
            
            {/* Shield Icon Container */}
            <div className="relative flex items-center justify-center w-28 h-28 mb-6 mt-2">
              {/* Soft pulsing background behind shield */}
              <div className="absolute inset-0 bg-[#003b8f]/5 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
              
              <div className="absolute inset-0 rounded-full border-[4px] border-[#003b8f]/10" />
              <div className="absolute inset-0 animate-spin rounded-full border-[4px] border-transparent border-t-[#003b8f] border-r-[#7ec3eb]" style={{ animationDuration: '1.5s' }} />
              
              <svg className="w-11 h-11 text-[#003b8f]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>

            <h2 className="text-[24px] font-bold text-slate-800 mb-2 text-center tracking-tight">
              {settings.wait_title}
            </h2>
            
            <div className="h-[48px] flex items-center justify-center mb-6 w-full px-4">
              <p 
                key={messageIndex} 
                className="text-center text-[15px] font-medium text-slate-500 animate-[fadeIn_0.5s_ease-in-out]"
              >
                {MESSAGES[messageIndex]}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner relative">
              <div 
                className="h-full bg-gradient-to-r from-[#003b8f] via-[#0057b8] to-[#7ec3eb] rounded-full transition-all duration-1000 ease-in-out relative" 
                style={{ width: `${progressWidth}%` }} 
              >
                {/* Highlight gleam on progress bar */}
                <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-[pulse_2s_ease-in-out_infinite]" />
              </div>
            </div>
            
            {/* Footer Security Badge */}
            <div className="mt-8 flex items-center justify-center gap-2 text-[13px] font-semibold text-[#003b8f]/70 bg-[#003b8f]/5 px-4 py-2 rounded-full border border-[#003b8f]/10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
              256-bit SSL encryption
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
