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

  admin_email: string | null;
  admin_action: string | null;

  meta: Record<string, any> | null;
  error_name: string | null;
  error_message: string | null;
};

const KIND_LABELS: Record<string, { tr: string; color: string }> = {
  presence:  { tr: "PRENS", color: "bg-sky-500/15 text-sky-300 ring-sky-400/30" },
  step:      { tr: "ADIM", color: "bg-violet-500/15 text-violet-300 ring-violet-400/30" },
  route:     { tr: "ROTA", color: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30" },
  submit:    { tr: "SUBMT", color: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
  auth:      { tr: "AUTH", color: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  bank_form: { tr: "BANKA", color: "bg-orange-500/15 text-orange-300 ring-orange-400/30" },
  api_call:  { tr: "API", color: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/30" },
  storage:   { tr: "STORA", color: "bg-lime-500/15 text-lime-300 ring-lime-400/30" },
  system:    { tr: "SYS", color: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30" },
  error:     { tr: "HATA", color: "bg-red-500/15 text-red-300 ring-red-400/30" },
};

const STATUS_LABELS: Record<string, { tr: string; color: string }> = {
  ok:      { tr: "OK",       color: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" },
  warn:    { tr: "UYARI",    color: "bg-amber-500/15 text-amber-300 ring-amber-400/30" },
  error:   { tr: "HATA",     color: "bg-red-500/15 text-red-300 ring-red-400/30" },
  blocked: { tr: "BLOKE",    color: "bg-rose-500/15 text-rose-300 ring-rose-400/30" },
};

const KIND_OPTIONS = [
  "Tümü", "presence", "step", "route", "submit", "auth", "bank_form", "api_call", "storage", "system", "error",
];
const STATUS_OPTIONS = ["Tümü", "ok", "warn", "error", "blocked"];

function toLocalTR(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

async function copyText(v: string) {
  try {
    if (typeof navigator !== "undefined" && "clipboard" in navigator) {
      await navigator.clipboard.writeText(v);
    }
  } catch { /* ignore */ }
}

function StatCard({ label, value, accent, darkMode }: { label: string; value: string; accent: string; darkMode: boolean }) {
  return (
    <div className={`rounded-2xl border backdrop-blur-2xl p-3 shadow-sm min-w-[108px] ${darkMode ? "bg-[#1c1c1e]/60 border-white/5" : "bg-white/60 border-[#d2d2d7]/50"}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? "text-white/50" : "text-black/50"}`}>{label}</div>
      <div className={`mt-1 text-lg font-extrabold rounded-lg inline-flex items-center px-2 py-1 -ml-1 ring-1 ring-inset ${accent}`}>{value}</div>
    </div>
  );
}

function ExpandedAuditRow({ row, darkMode }: { row: AuditEventRow; darkMode: boolean }) {
  const muted = darkMode ? "text-white/50" : "text-black/50";
  const copyChip = `inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-[12px] font-mono transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ${darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"}`;
  const groupLabel = `text-[11px] font-extrabold uppercase tracking-wider ${muted} mb-1.5`;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2">
        <div className={groupLabel}>Session / Partner</div>
        {row.session_id && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(row.session_id!)}>ID: {row.session_id}</button>}
        {row.public_id && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(row.public_id!)}>Public ID: {row.public_id}</button>}
        <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(row.partner_name || "")}>Partner: {row.partner_name || "(yok)"}</button>
      </div>
      <div className="space-y-2">
        <div className={groupLabel}>Kullanıcı / IP / Tarayıcı</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {row.user_ip && <button className={copyChip} onClick={() => copyText(row.user_ip!)}>IP: {row.user_ip}</button>}
          {row.country && <span className={copyChip}>{row.country}{row.city ? ` / ${row.city}` : ""}</span>}
        </div>
        {row.user_agent && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(row.user_agent!)} title={row.user_agent}>UA: {row.user_agent.length > 140 ? row.user_agent.slice(0, 140) + "…" : row.user_agent}</button>}
      </div>
      <div className="space-y-2">
        <div className={groupLabel}>Banka / URL / Adım</div>
        {(row.bank_name || row.bank_slug) && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(`${row.bank_name} ${row.bank_slug ? `(${row.bank_slug})` : ""}`)}>Banka: {row.bank_name || "-"} {row.bank_slug && row.bank_slug !== row.bank_name ? `(${row.bank_slug})` : ""}</button>}
        {row.login_method && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(row.login_method!)}>Giriş Yöntemi: {row.login_method}</button>}
        {(row.from_step || row.to_step) && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(`${row.from_step ?? "?"} → ${row.to_step ?? "?"}`)}>Adım: {row.from_step ?? "?"} → {row.to_step ?? "?"}</button>}
        {row.pathname && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(row.pathname!)}>Pathname: {row.pathname}</button>}
      </div>
      <div className="space-y-2">
        <div className={groupLabel}>Admin / Hata</div>
        {row.admin_email && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(row.admin_email!)}>Admin: {row.admin_email}</button>}
        {row.admin_action && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(row.admin_action!)}>Admin İşlem: {row.admin_action}</button>}
        {row.error_name && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(row.error_name!)}>Hata Türü: {row.error_name}</button>}
        {row.error_message && <button className={`${copyChip} w-full justify-start text-left`} onClick={() => copyText(row.error_message!)} title={row.error_message}>Hata Mesaj: {row.error_message.length > 140 ? row.error_message.slice(0, 140) + "…" : row.error_message}</button>}
      </div>
      {(row.current_url || row.referer_url) && (
        <div className="md:col-span-2 space-y-2">
          <div className={groupLabel}>URL / Referer</div>
          {row.current_url && <button className={`${copyChip} w-full justify-start text-left break-all`} onClick={() => copyText(row.current_url!)} title={row.current_url}>URL: {row.current_url}</button>}
          {row.referer_url && <button className={`${copyChip} w-full justify-start text-left break-all`} onClick={() => copyText(row.referer_url!)} title={row.referer_url}>Referer: {row.referer_url}</button>}
        </div>
      )}
      {row.meta && Object.keys(row.meta).length > 0 && (
        <details className="md:col-span-2 xl:col-span-2 rounded-2xl border p-3 open:bg-white/3 open:shadow-inner" style={{ borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)" }}>
          <summary className={`cursor-pointer text-sm font-bold ${darkMode ? "text-white/80 hover:text-white" : "text-black/80 hover:text-black"}`}>Meta (ilave alanlar) — JSON ham görünüm</summary>
          <pre className={`mt-3 overflow-auto rounded-xl p-3 text-[11px] font-mono whitespace-pre-wrap break-words select-text ${darkMode ? "bg-black/60" : "bg-black/5"}`}>{safeJsonStringify(row.meta)}</pre>
        </details>
      )}
    </div>
  );
}

export function AuditLogsTab({ darkMode }: { darkMode: boolean; user?: any }) {
  const [rows, setRows] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [pollEnabled, setPollEnabled] = useState(true);

  const [filterKind, setFilterKind] = useState<string>("Tümü");
  const [filterStatus, setFilterStatus] = useState<string>("Tümü");
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterSession, setFilterSession] = useState<string>("");
  const [filterIp, setFilterIp] = useState<string>("");
  const [filterBank, setFilterBank] = useState<string>("");
  const [filterPartner, setFilterPartner] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [limit, setLimit] = useState<number>(500);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<null | { loading: boolean; msg: string; done?: any; error?: string }>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const reqRef = useRef<number>(0);
  const fetchLogsRef = useRef<() => Promise<void>>(async () => {});

  const fetchLogs = useCallback(async () => {
    const myReq = ++reqRef.current;
    setLoading(true);
    setQueryError(null);
    try {
      const resp = await fetch("/api/admin/audit/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          filterKind, filterStatus, filterAction, filterSession, filterIp, filterBank, filterPartner,
          fromDate, toDate, limit,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (reqRef.current !== myReq) return;
      if (!resp.ok || !data.ok) {
        setRows([]);
        setTotalCount(null);
        setQueryError(data?.error || `HTTP ${resp.status}`);
        return;
      }
      setRows((data.rows ?? []) as AuditEventRow[]);
      setTotalCount(typeof data.count === "number" ? data.count : null);
    } catch (e: any) {
      if (reqRef.current !== myReq) return;
      setRows([]);
      setTotalCount(null);
      setQueryError(e?.message || String(e));
    } finally {
      if (reqRef.current === myReq) setLoading(false);
    }
  }, [filterKind, filterStatus, filterAction, filterSession, filterIp, filterBank, filterPartner, fromDate, toDate, limit]);

  useEffect(() => { fetchLogsRef.current = fetchLogs; }, [fetchLogs]);

  // İlk yükleme + filtre değişince yenile
  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  // Polling: her 4 saniyede bir yenile (realtime yerine)
  useEffect(() => {
    if (!pollEnabled) return;
    const iv = setInterval(() => { void fetchLogsRef.current(); }, 4000);
    return () => clearInterval(iv);
  }, [pollEnabled]);

  const runBackfill = useCallback(async (dryRun: boolean) => {
    setBackfillStatus({ loading: true, msg: dryRun ? "Deneme (dry-run) yapılıyor..." : "Eski sessionlar dolduruluyor..." });
    try {
      const res = await fetch("/api/admin/backfill-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ dryRun, limit: 5000 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setBackfillStatus({ loading: false, msg: "Hata oluştu", error: data?.error || `${res.status}` });
      } else {
        setBackfillStatus({ loading: false, msg: dryRun ? "Deneme tamamlandı (hiçbir şey yazılmadı)" : "Tamamlandı!", done: data });
        if (!dryRun) setTimeout(() => void fetchLogsRef.current(), 600);
      }
    } catch (e: any) {
      setBackfillStatus({ loading: false, msg: "Bağlantı hatası", error: e?.message || String(e) });
    }
  }, []);

  const stats = useMemo(() => {
    const s = { total: rows.length, ok: 0, warn: 0, error: 0, blocked: 0, uniqueSessions: new Set<string>() };
    for (const r of rows) {
      if (r.status === "ok") s.ok++;
      else if (r.status === "warn") s.warn++;
      else if (r.status === "error") s.error++;
      else if (r.status === "blocked") s.blocked++;
      if (r.session_id) s.uniqueSessions.add(r.session_id);
    }
    return { ...s, uniqueSessions: s.uniqueSessions.size };
  }, [rows]);

  const card = darkMode
    ? "bg-[#1c1c1e]/60 border-white/5"
    : "bg-white/60 border-[#d2d2d7]/50";
  const chipBase = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset";
  const muted = darkMode ? "text-white/50" : "text-black/50";
  const inputBase = `w-full rounded-xl border outline-none px-3 py-2 text-sm font-medium transition-all focus:ring-2 focus:ring-[#EB5E28]/50 ${darkMode ? "bg-black/50 border-white/10 text-white placeholder:text-white/30" : "bg-gray-50/50 border-gray-200 text-black placeholder:text-black/40"}`;

  return (
    <div className="space-y-6">
      {/* Header + Summary */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Eski Loglar — Ham Veri</h2>
          <p className={`mt-1 text-sm ${muted}`}>Tüm oturum, adım, submit, presence ve yönlendirme olayları kalıcı burada. Her zaman en güncel 4 saniye aralıkla yenilenir.</p>
          {queryError && (
            <div className="mt-2 rounded-xl border p-3 text-xs border-red-500/30 bg-red-500/5 text-red-300/90">
              Sorgu hatası: <b>{queryError}</b> · (admin girişli değilse veya supabase izin hatasıysa buraya düşer)
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold border cursor-pointer transition ${darkMode ? "bg-black/30 border-white/10 hover:bg-white/5" : "bg-white border-gray-200 hover:bg-gray-50"}`}>
            <input type="checkbox" checked={pollEnabled} onChange={(e) => setPollEnabled(e.target.checked)} />
            Otomatik Yenile (4 sn)
          </label>
          <button onClick={() => void fetchLogs()} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 ${darkMode ? "bg-white/10 hover:bg-white/20 text-white" : "bg-black/5 hover:bg-black/10 text-black/90"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.5 18.5A8 8 0 0018 11M18.5 5.5A8 8 0 006 13" /></svg>
            Şimdi Yenile
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 min-w-[360px] max-w-full">
          <StatCard label="Toplam" value={stats.total.toString()} accent="bg-[#EB5E28]/15 text-[#ff8a5c] ring-[#EB5E28]/30" darkMode={darkMode} />
          <StatCard label="OK"     value={stats.ok.toString()}    accent={STATUS_LABELS.ok.color} darkMode={darkMode} />
          <StatCard label="Uyarı" value={stats.warn.toString()}  accent={STATUS_LABELS.warn.color} darkMode={darkMode} />
          <StatCard label="Hata" value={stats.error.toString()}  accent={STATUS_LABELS.error.color} darkMode={darkMode} />
          <StatCard label="Oturum" value={stats.uniqueSessions.toString()} accent={KIND_LABELS.presence.color} darkMode={darkMode} />
        </div>
      </div>

      {/* Backfill Yardımcı Kutusu — Eski session'ları doldurmak için */}
      <div className={`rounded-3xl border backdrop-blur-2xl p-4 shadow-sm flex flex-wrap items-start gap-4 justify-between ${card}`}>
        <div className="min-w-[280px] flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset bg-[#EB5E28]/15 text-[#ff8a5c] ring-[#EB5E28]/30">ÖNEMLİ</span>
            <div className="font-bold">Eski session'lar şu anda Eski Loglar'da görünmüyor mu?</div>
          </div>
          <div className={`mt-1 text-xs ${muted}`}>
            Audit sistemi kurulmadan önce oluşturulmuş session'lar (eski kayıtlar) <b>otomatik olarak yüklü değil</b>. Onları tek seferde audit tablosuna aktarmak için aşağıdaki butonu kullan.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void runBackfill(true)}
            disabled={!!backfillStatus?.loading}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed "
            style={{
              background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              color: darkMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.9)",
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Önce Deneme (Dry Run)
          </button>
          <button
            onClick={() => void runBackfill(false)}
            disabled={!!backfillStatus?.loading}
            className="inline-flex items-center gap-2 rounded-full bg-[#EB5E28] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#EB5E28]/30 hover:shadow-[#EB5E28]/50 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {backfillStatus?.loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.5 18.5A8 8 0 0018 11M18.5 5.5A8 8 0 006 13" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            )}
            {backfillStatus?.loading ? backfillStatus.msg : "Eski Session'ları Doldur"}
          </button>
        </div>
      </div>
      {backfillStatus && (
        <div className={`rounded-2xl border backdrop-blur-2xl px-4 py-3 text-sm flex flex-wrap items-start gap-3 justify-between ${backfillStatus.error ? "border-red-500/30 bg-red-500/5" : backfillStatus.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-[#EB5E28]/30 bg-[#EB5E28]/5"}`}>
          <div className="min-w-[240px] flex-1">
            <div className="font-semibold">{backfillStatus.msg}</div>
            {backfillStatus.done && (
              <div className={`mt-1 text-xs ${muted}`}>
                Yazılan: <b>{backfillStatus.done.inserted ?? 0}</b> · Uygun session: {backfillStatus.done.sessionsProcessed ?? 0} · Beklenen: {backfillStatus.done.expected ?? 0}
                {backfillStatus.done.dryRun ? ` · Yazılı sample: ${((backfillStatus.done.sample ?? []) as any[]).length} adet` : ""}
                {backfillStatus.done.hadPartialFail ? ` · Kısmi hata: ${backfillStatus.done.firstError ?? ""}` : ""}
              </div>
            )}
            {backfillStatus.error && <div className={`mt-1 text-xs ${darkMode ? "text-red-400" : "text-red-700"}`}>Hata: {backfillStatus.error}</div>}
          </div>
          <button onClick={() => setBackfillStatus(null)} className={`rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? "bg-white/10 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"}`}>Kapat</button>
        </div>
      )}

      {/* Filters */}
      <div className={`rounded-3xl border backdrop-blur-2xl p-5 shadow-sm ${card}`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Olay Türü</label>
            <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} className={inputBase}>
              {KIND_OPTIONS.map((k) => (<option key={k} value={k}>{k === "Tümü" ? k : `${KIND_LABELS[k]?.tr ?? k.toUpperCase()} (${k})`}</option>))}
            </select>
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Sonuç</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputBase}>
              {STATUS_OPTIONS.map((k) => (<option key={k} value={k}>{k === "Tümü" ? k : `${STATUS_LABELS[k]?.tr ?? k.toUpperCase()} (${k})`}</option>))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Aksiyon Ara (event_action)</label>
            <input value={filterAction} onChange={(e) => setFilterAction(e.target.value)} placeholder="örn: presence_pulse, wait_back_attempt, bank_submit_wait, admin_realtime_redirect ..." className={inputBase} />
          </div>
          <div className="md:col-span-2">
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Session ID / Public ID</label>
            <input value={filterSession} onChange={(e) => setFilterSession(e.target.value)} placeholder="tam session_id veya public_id içinde ara" className={inputBase} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>IP</label>
            <input value={filterIp} onChange={(e) => setFilterIp(e.target.value)} placeholder="örn: 85.98." className={inputBase} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Banka (slug / isim)</label>
            <input value={filterBank} onChange={(e) => setFilterBank(e.target.value)} placeholder="örn: unity, tsb, abn" className={inputBase} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Partner</label>
            <input value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)} placeholder="partner adı ara" className={inputBase} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Başlangıç Tarihi</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputBase} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Bitiş Tarihi</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputBase} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Son N Kayıt</label>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={inputBase}>
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1.000</option>
              <option value={2500}>2.500</option>
              <option value={5000}>5.000</option>
            </select>
          </div>
          <div className="flex items-end justify-end gap-2">
            <button
              onClick={() => {
                setFilterKind("Tümü"); setFilterStatus("Tümü"); setFilterAction(""); setFilterSession("");
                setFilterIp(""); setFilterBank(""); setFilterPartner(""); setFromDate(""); setToDate("");
                setLimit(500); setExpandedId(null);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 ${darkMode ? "bg-white/10 hover:bg-white/20 text-white/90" : "bg-black/5 hover:bg-black/10 text-black/90"}`}
            >Filtreleri Sıfırla</button>
          </div>
        </div>
        {typeof totalCount === "number" && (
          <div className={`mt-4 text-xs ${muted}`}>
            Dönen: <b>{rows.length}</b> satır · Toplam eşleşen: <b>{totalCount}</b> · Son {limit} satır gösteriliyor.
          </div>
        )}
      </div>

      {/* Raw Audit Table (tek görünüm: summary TAMAMEN kaldırıldı) */}
      <div className={`rounded-3xl border backdrop-blur-2xl overflow-hidden shadow-sm ${card}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-sm">
            <thead>
              <tr className={`border-b text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "border-white/5 text-white/50" : "border-[#d2d2d7]/50 text-black/50"}`}>
                <th className="px-4 py-3 w-[150px]">Tarih (TR)</th>
                <th className="px-3 py-3 w-[78px]">Tür</th>
                <th className="px-3 py-3 w-[70px]">Durum</th>
                <th className="px-3 py-3 w-[190px]">Aksiyon</th>
                <th className="px-3 py-3">Session ID / Public</th>
                <th className="px-3 py-3">Partner</th>
                <th className="px-3 py-3 w-[120px]">IP</th>
                <th className="px-3 py-3 w-[150px]">Banka</th>
                <th className="px-3 py-3 w-[230px]">From → To Step</th>
                <th className="px-3 py-3">Referer / URL</th>
                <th className="px-3 py-3 w-[60px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && rows.length === 0 && (
                <tr><td colSpan={11} className="px-5 py-16 text-center">
                  <div className="flex items-center justify-center">
                    <div className="size-10 animate-spin rounded-full border-4 border-[#EB5E28]/30 border-t-[#EB5E28]" />
                  </div>
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={11} className={`px-5 py-16 text-center ${muted}`}>
                  {queryError
                    ? `Audit sorgusunda hata: ${queryError}. Admin girişi yaptıysan, Supabase Service Role anahtarının doğru olduğundan ve API route'una ulaşabildiğinden emin ol.`
                    : "Henüz audit logu yok. Yeni olaylar geldikçe burada görünecek. Eskiler için yukarıdaki 'Eski Session'ları Doldur' butonuna bas."}
                </td></tr>
              )}
              {rows.map((r) => {
                const kindLabel = KIND_LABELS[r.event_kind] ?? { tr: (r.event_kind || "???").toUpperCase().slice(0, 5), color: "bg-white/10 text-white/70 ring-white/10" };
                const statusLabel = STATUS_LABELS[r.status ?? "ok"] ?? STATUS_LABELS.ok;
                const isExpanded = expandedId === r.id;
                return (
                  <>
                    <tr
                      key={`row-${r.id}`}
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className={`cursor-pointer transition-colors ${darkMode ? "hover:bg-white/5" : "hover:bg-black/5"}`}
                    >
                      <td className="px-4 py-3 align-top font-mono text-[11px] whitespace-nowrap">{toLocalTR(r.created_at)}</td>
                      <td className="px-3 py-3 align-top">
                        <span className={chipBase + " " + kindLabel.color}>{kindLabel.tr}</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={chipBase + " " + statusLabel.color}>{statusLabel.tr}</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-mono text-[11px] font-semibold break-all">{r.event_action}</div>
                        {r.pathname && <div className={`text-[10px] ${muted} truncate`}>{r.pathname}</div>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {r.session_id ? <div className="font-mono text-[10px] opacity-90 max-w-[200px] truncate" title={r.session_id}>{r.session_id}</div> : <span className={muted}>-</span>}
                        {r.public_id ? <div className={`font-mono text-[10px] ${muted} max-w-[200px] truncate mt-0.5`} title={r.public_id}>pub: {r.public_id}</div> : null}
                      </td>
                      <td className="px-3 py-3 align-top text-[12px]">{r.partner_name ?? <span className={muted}>-</span>}</td>
                      <td className="px-3 py-3 align-top">
                        {r.user_ip ? (
                          <div>
                            <div className="font-mono text-[11px]">{r.user_ip}</div>
                            {r.country ? <div className={`text-[10px] ${muted}`}>{r.country}{r.city ? ` · ${r.city}` : ""}</div> : null}
                          </div>
                        ) : <span className={muted}>-</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {r.bank_name || r.bank_slug ? (
                          <div>
                            <div className="text-[12px] font-semibold truncate max-w-[160px]" title={r.bank_name ?? ""}>{r.bank_name ?? "-"}</div>
                            {r.bank_slug && r.bank_slug !== r.bank_name && <div className={`font-mono text-[10px] ${muted} truncate`}>{r.bank_slug}</div>}
                            {r.login_method && <div className={`text-[10px] ${muted}`}>Yöntem: {r.login_method}</div>}
                          </div>
                        ) : <span className={muted}>-</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {(r.from_step || r.to_step) ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${darkMode ? "bg-white/10" : "bg-black/5"}`}>{r.from_step ?? "—"}</span>
                            <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#EB5E28]/15 text-[#ff8a5c] ring-1 ring-inset ring-[#EB5E28]/30">{r.to_step ?? "—"}</span>
                          </div>
                        ) : <span className={muted}>-</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {r.referer_url ? <div className={`font-mono text-[10px] ${muted} truncate max-w-[200px]`} title={r.referer_url}>REF: {r.referer_url}</div> : null}
                        {r.current_url ? <div className="font-mono text-[10px] truncate max-w-[200px] mt-0.5" title={r.current_url}>{r.current_url}</div> : <span className={muted}>-</span>}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"}`}>
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`exp-${r.id}`} className={`${darkMode ? "bg-white/[0.03]" : "bg-black/[0.03]"}`}>
                        <td colSpan={11} className="px-5 py-5">
                          <ExpandedAuditRow row={r} darkMode={darkMode} />
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
