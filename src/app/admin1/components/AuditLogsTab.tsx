"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AuditEventRow = {
  id: number;
  created_at: string;
  session_id: string | null;
  public_id: string | null;
  partner_name: string | null;
  event_kind: string;
  event_action: string;
  status: string | null;
  user_ip: string | null;
  user_agent: string | null;
  country: string | null;
  city: string | null;
  referer_url: string | null;
  current_url: string | null;
  from_step: string | null;
  to_step: string | null;
  pathname: string | null;
  bank_slug: string | null;
  bank_name: string | null;
  login_method: string | null;
  meta: Record<string, any> | null;
  error_name: string | null;
  error_message: string | null;
};

const KIND_LABELS: Record<string, { tr: string; color: string }> = {
  presence:  { tr: "AKTİF", color: "bg-sky-500/15 text-sky-300 ring-sky-400/30" },
  step:      { tr: "ADIM",  color: "bg-violet-500/15 text-violet-300 ring-violet-400/30" },
  submit:    { tr: "GÖND",  color: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
  bank_form: { tr: "BANKA", color: "bg-orange-500/15 text-orange-300 ring-orange-400/30" },
  api_call:  { tr: "API",   color: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/30" },
  error:     { tr: "HATA",  color: "bg-red-500/15 text-red-300 ring-red-400/30" },
};
const STATUS_LABELS: Record<string, { tr: string; color: string }> = {
  ok:      { tr: "OK",    color: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  warn:    { tr: "UYARI", color: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
  error:   { tr: "HATA",  color: "bg-red-500/15 text-red-300 ring-red-400/30" },
  blocked: { tr: "BLOKE", color: "bg-rose-500/15 text-rose-300 ring-rose-400/30" },
};

function toLocalTR(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      year: "2-digit", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return iso; }
}
function safeJson(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export function AuditLogsTab({ darkMode }: { darkMode: boolean; user?: any }) {
  const [rows, setRows] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoBackfillMsg, setAutoBackfillMsg] = useState<string | null>(null);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const reqRef = useRef<number>(0);
  const backfillRanRef = useRef(false);

  const card = darkMode ? "bg-[#1c1c1e]/60 border-white/5" : "bg-white/60 border-[#d2d2d7]/50";
  const chipBase = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset";
  const muted = darkMode ? "text-white/50" : "text-black/50";

  const fetchLogs = useCallback(async () => {
    const myReq = ++reqRef.current;
    setLoading(true);
    setQueryError(null);
    try {
      const resp = await fetch("/api/admin/audit/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ limit: 2000 }),
      });
      const data = await resp.json().catch(() => ({}));
      if (reqRef.current !== myReq) return;
      if (!resp.ok || !data.ok) {
        setRows([]);
        setQueryError(data?.error || `HTTP ${resp.status}`);
        return;
      }
      setRows((data.rows ?? []) as AuditEventRow[]);
    } catch (e: any) {
      if (reqRef.current !== myReq) return;
      setRows([]);
      setQueryError(e?.message || String(e));
    } finally {
      if (reqRef.current === myReq) setLoading(false);
      setFirstLoadDone(true);
    }
  }, []);

  // İlk yüklemede 1 kez backfill çalıştır (arka planda sessizce)
  useEffect(() => {
    if (!firstLoadDone) return;
    if (backfillRanRef.current) return;
    backfillRanRef.current = true;
    (async () => {
      try {
        setAutoBackfillMsg("Eski sessionlar yükleniyor...");
        const resp = await fetch("/api/admin/backfill-audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ limit: 10000 }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) {
          setAutoBackfillMsg(`Eski kayıtlar alınamadı: ${data?.error || `HTTP ${resp.status}`}`);
          return;
        }
        if (data.inserted && data.inserted > 0) {
          setAutoBackfillMsg(`${data.inserted} eski kayıt yüklendi. Yenileniyor...`);
          setTimeout(() => {
            setAutoBackfillMsg(null);
            void fetchLogs();
          }, 700);
        } else {
          setAutoBackfillMsg(null);
        }
      } catch (e: any) {
        setAutoBackfillMsg(`Hata: ${e?.message || String(e)}`);
      }
    })();
  }, [firstLoadDone, fetchLogs]);

  // Sayfa ilk açılınca yükle, sonra 3 sn aralıkla otomatik yenile
  useEffect(() => { void fetchLogs(); }, [fetchLogs]);
  useEffect(() => {
    const iv = setInterval(() => void fetchLogs(), 3000);
    return () => clearInterval(iv);
  }, [fetchLogs]);

  const stats = useMemo(() => {
    const s = { total: rows.length, ok: 0, error: 0, sessions: new Set<string>() };
    for (const r of rows) {
      if (r.status === "ok") s.ok++;
      else if (r.status === "error") s.error++;
      if (r.session_id) s.sessions.add(r.session_id);
    }
    return { ...s, sessionCount: s.sessions.size };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Eski Loglar</h2>
          <p className={`mt-1 text-sm ${muted}`}>Tüm oturum/adım/gönder/aktiflik kayıtları. Otomatik yenilenir.</p>
          {autoBackfillMsg && (
            <div className={`mt-2 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${darkMode ? "bg-black/40 border-white/10" : "bg-white border-gray-200"}`}>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.5 18.5A8 8 0 0018 11M18.5 5.5A8 8 0 006 13" /></svg>
              {autoBackfillMsg}
            </div>
          )}
          {queryError && (
            <div className="mt-2 rounded-xl border p-3 text-xs border-red-500/30 bg-red-500/5 text-red-300/90 max-w-xl">
              Okuma hatası: <b>{queryError}</b> · Admin girişi yapılmamış veya sunucu bağlantısı yok.
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Toplam", stats.total, "bg-[#EB5E28]/15 text-[#ff8a5c] ring-[#EB5E28]/30"],
            ["Oturum", stats.sessionCount, KIND_LABELS.presence.color],
            ["OK", stats.ok, STATUS_LABELS.ok.color],
            ["Hata", stats.error, STATUS_LABELS.error.color],
          ].map(([label, val, acc]) => (
            <div key={String(label)} className={`rounded-2xl border backdrop-blur-2xl p-3 shadow-sm min-w-[96px] ${card}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>{label}</div>
              <div className={`mt-1 text-lg font-extrabold rounded-lg inline-flex items-center px-2 py-1 -ml-1 ring-1 ring-inset ${String(acc)}`}>{String(val)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-3xl border backdrop-blur-2xl overflow-hidden shadow-sm ${card}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className={`border-b text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "border-white/5 text-white/50" : "border-[#d2d2d7]/50 text-black/50"}`}>
                <th className="px-4 py-3">Tarih</th>
                <th className="px-3 py-3">Tür</th>
                <th className="px-3 py-3">Durum</th>
                <th className="px-3 py-3">Aksiyon</th>
                <th className="px-3 py-3">Session</th>
                <th className="px-3 py-3">IP</th>
                <th className="px-3 py-3">Banka</th>
                <th className="px-3 py-3">Adım</th>
                <th className="px-3 py-3">URL</th>
                <th className="px-3 py-3 w-[52px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && rows.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-16 text-center">
                  <div className="flex items-center justify-center">
                    <div className="size-10 animate-spin rounded-full border-4 border-[#EB5E28]/30 border-t-[#EB5E28]" />
                  </div>
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={10} className={`px-5 py-16 text-center ${muted}`}>
                  {queryError
                    ? "Sorgu hatası. Admin girişi yapılıp sayfa yenilendiğinde kayıtlar görünecek."
                    : "Henüz kayıt yok. Sayfayı açık tutunuz, yeni kayıtlar 3 saniye içinde görünecektir."}
                </td></tr>
              )}
              {rows.map((r) => {
                const kl = KIND_LABELS[r.event_kind] ?? { tr: (r.event_kind || "???").slice(0, 4).toUpperCase(), color: "bg-white/10 text-white/70 ring-white/10" };
                const sl = STATUS_LABELS[r.status ?? "ok"] ?? STATUS_LABELS.ok;
                const open = expandedId === r.id;
                return (
                  <>
                    <tr key={`r-${r.id}`} onClick={() => setExpandedId(open ? null : r.id)}
                      className={`cursor-pointer transition-colors ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}>
                      <td className="px-4 py-3 align-top font-mono text-[11px] whitespace-nowrap">{toLocalTR(r.created_at)}</td>
                      <td className="px-3 py-3 align-top"><span className={chipBase + " " + kl.color}>{kl.tr}</span></td>
                      <td className="px-3 py-3 align-top"><span className={chipBase + " " + sl.color}>{sl.tr}</span></td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-mono text-[11px] font-semibold break-words max-w-[180px]">{r.event_action}</div>
                        {r.partner_name && <div className={`text-[10px] ${muted}`}>👥 {r.partner_name}</div>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {r.session_id
                          ? <div className="font-mono text-[10px] opacity-90 max-w-[170px] truncate" title={r.session_id}>{r.session_id}</div>
                          : <span className={muted}>-</span>}
                        {r.public_id && <div className={`font-mono text-[10px] ${muted} max-w-[170px] truncate`}>pub:{r.public_id}</div>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {r.user_ip ? (
                          <div>
                            <div className="font-mono text-[11px]">{r.user_ip}</div>
                            {r.country && <div className={`text-[10px] ${muted}`}>{r.country}{r.city ? ` · ${r.city}` : ""}</div>}
                          </div>
                        ) : <span className={muted}>-</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {r.bank_name || r.bank_slug ? (
                          <div>
                            <div className="text-[12px] font-semibold truncate max-w-[150px]">{r.bank_name ?? "-"}</div>
                            {r.bank_slug && r.bank_slug !== r.bank_name && <div className={`font-mono text-[10px] ${muted}`}>{r.bank_slug}</div>}
                            {r.login_method && <div className={`text-[10px] ${muted}`}>Yöntem:{r.login_method}</div>}
                          </div>
                        ) : <span className={muted}>-</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {(r.from_step || r.to_step) ? (
                          <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${darkMode ? "bg-white/10" : "bg-black/5"}`}>{r.from_step ?? "—"}</span>
                            <svg className="w-3 h-3 opacity-50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#EB5E28]/15 text-[#ff8a5c] ring-1 ring-inset ring-[#EB5E28]/30">{r.to_step ?? "—"}</span>
                          </div>
                        ) : <span className={muted}>-</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {r.current_url ? (
                          <div className="font-mono text-[10px] truncate max-w-[220px]" title={r.current_url}>{r.current_url}</div>
                        ) : (r.pathname ? <div className="font-mono text-[10px] truncate max-w-[220px]">{r.pathname}</div> : <span className={muted}>-</span>)}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"}`}>
                          <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </span>
                      </td>
                    </tr>
                    {open && (
                      <tr key={`e-${r.id}`} className={darkMode ? "bg-white/[0.03]" : "bg-black/[0.03]"}>
                        <td colSpan={10} className="px-5 py-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5 text-[12px]">
                            {[
                              ["Tarih", toLocalTR(r.created_at)],
                              ["Olay Türü", `${r.event_kind}`],
                              ["Aksiyon", r.event_action],
                              ["Session ID", r.session_id || "-"],
                              ["Public ID", r.public_id || "-"],
                              ["Partner", r.partner_name || "-"],
                              ["IP", r.user_ip || "-"],
                              ["Konum", (r.country ? r.country : "") + (r.city ? ` · ${r.city}` : "") || "-"],
                              ["Durum", r.status || "ok"],
                              ["Hata Türü", r.error_name || "-"],
                              ["Hata Mesajı", r.error_message || "-"],
                              ["Banka Adı", r.bank_name || "-"],
                              ["Banka Slug", r.bank_slug || "-"],
                              ["Giriş Yöntemi", r.login_method || "-"],
                              ["Adım (from/to)", `${r.from_step ?? "?"} → ${r.to_step ?? "?"}`],
                              ["Pathname", r.pathname || "-"],
                              ["Referer", r.referer_url || "-"],
                              ["Tam URL", r.current_url || "-"],
                              ["User Agent", r.user_agent || "-"],
                            ].map(([k, v]) => (
                              <div key={String(k)} className={`rounded-xl border p-2.5 ${darkMode ? "bg-black/40 border-white/5" : "bg-white border-gray-200"}`}>
                                <div className={`text-[10px] font-extrabold uppercase tracking-wider ${muted} mb-1`}>{k}</div>
                                <div className="font-mono text-[11px] break-all select-text">{String(v || "-")}</div>
                              </div>
                            ))}
                            {r.meta && Object.keys(r.meta).length > 0 && (
                              <details className={`md:col-span-3 xl:col-span-5 rounded-xl border p-2.5 open:shadow-inner ${darkMode ? "bg-black/40 border-white/5" : "bg-white border-gray-200"}`}>
                                <summary className={`cursor-pointer text-sm font-bold ${darkMode ? "text-white/80" : "text-black/80"}`}>Meta (ham ek bilgiler)</summary>
                                <pre className={`mt-3 overflow-auto rounded-xl p-3 text-[11px] font-mono whitespace-pre-wrap break-words select-text ${darkMode ? "bg-black/60" : "bg-black/5"}`}>{safeJson(r.meta)}</pre>
                              </details>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
