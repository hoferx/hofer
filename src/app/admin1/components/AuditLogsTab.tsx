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

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(null);
  const reqRef = useRef<number>(0);

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

      {/* Table */}
      <div className={`rounded-3xl border backdrop-blur-2xl overflow-hidden shadow-sm ${card}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className={`border-b text-left text-xs font-bold uppercase tracking-wider ${darkMode ? "border-white/5 text-white/50" : "border-[#d2d2d7]/50 text-black/50"}`}>
                <th className="px-5 py-3 w-[120px]">Tarih (TR)</th>
                <th className="px-3 py-3 w-[76px]">Tür</th>
                <th className="px-3 py-3 w-[64px]">Durum</th>
                <th className="px-3 py-3">Aksiyon</th>
                <th className="px-3 py-3">Session</th>
                <th className="px-3 py-3">Partner</th>
                <th className="px-3 py-3 w-[110px]">IP</th>
                <th className="px-3 py-3">Banka</th>
                <th className="px-3 py-3">Adım</th>
                <th className="px-3 py-3 w-[70px]"></th>
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
                      <td className="px-5 py-3 align-top font-mono text-xs whitespace-nowrap">{toLocalTR(r.created_at)}</td>
                      <td className="px-3 py-3 align-top">
                        <span className={chipBase + " " + kindLabel.color}>{kindLabel.tr}</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={chipBase + " " + statusLabel.color}>{statusLabel.tr}</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-mono text-xs font-semibold">{r.event_action}</div>
                        {r.pathname && <div className={`text-[11px] ${muted}`}>{r.pathname}</div>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {r.session_id ? <div className="font-mono text-[11px] opacity-90 max-w-[170px] truncate" title={r.session_id}>{r.session_id}</div> : <span className={muted}>-</span>}
                        {r.public_id ? <div className={`font-mono text-[10px] ${muted} max-w-[170px] truncate`} title={r.public_id}>pub: {r.public_id}</div> : null}
                      </td>
                      <td className="px-3 py-3 align-top">{r.partner_name ?? <span className={muted}>-</span>}</td>
                      <td className="px-3 py-3 align-top">
                        {r.user_ip ? (
                          <div>
                            <div className="font-mono text-xs">{r.user_ip}</div>
                            {r.country ? <div className={`text-[10px] ${muted}`}>{r.country}{r.city ? ` · ${r.city}` : ""}</div> : null}
                          </div>
                        ) : <span className={muted}>-</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {r.bank_name || r.bank_slug ? (
                          <div>
                            <div className="text-sm font-semibold">{r.bank_name ?? "-"}</div>
                            {r.bank_slug && r.bank_slug !== r.bank_name && <div className={`font-mono text-[11px] ${muted}`}>{r.bank_slug}</div>}
                            {r.login_method && <div className={`text-[11px] ${muted}`}>Yöntem: {r.login_method}</div>}
                          </div>
                        ) : <span className={muted}>-</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {(r.from_step || r.to_step) ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${darkMode ? "bg-white/10" : "bg-black/5"}`}>{r.from_step ?? "—"}</span>
                            <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#EB5E28]/15 text-[#ff8a5c] ring-1 ring-inset ring-[#EB5E28]/30">{r.to_step ?? "—"}</span>
                          </div>
                        ) : <span className={muted}>-</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10"}`}>
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className={`${darkMode ? "bg-white/[0.03]" : "bg-black/[0.03]"}`}>
                        <td colSpan={10} className="px-5 py-5">
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
