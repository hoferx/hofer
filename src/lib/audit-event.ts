"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type AuditEventKind =
  | "presence"
  | "step"
  | "route"
  | "submit"
  | "auth"
  | "bank_form"
  | "api_call"
  | "storage"
  | "system"
  | "error";

export type AuditEventPayload = {
  session_id?: string | null;
  public_id?: string | null;
  partner_name?: string | null;

  event_kind: AuditEventKind | string;
  event_action: string;

  status?: "ok" | "warn" | "error" | "blocked" | string | null;

  user_ip?: string | null;
  user_agent?: string | null;
  country?: string | null;
  city?: string | null;
  referer_url?: string | null;
  current_url?: string | null;

  from_step?: string | null;
  to_step?: string | null;
  pathname?: string | null;

  bank_slug?: string | null;
  bank_name?: string | null;
  login_method?: string | null;

  admin_email?: string | null;
  admin_action?: string | null;

  meta?: Record<string, any> | null;

  error_name?: string | null;
  error_message?: string | null;
};

// Debounce/batch etmek için küçük bir kuyruk:
type QueuedItem = { payload: AuditEventPayload; retries: number };
const QUEUE_FLUSH_MS = 1500;
const MAX_BATCH = 25;

let queue: QueuedItem[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function pickClientEnvFields(): Partial<AuditEventPayload> {
  if (typeof window === "undefined") return {};
  const nav = (typeof navigator !== "undefined" ? navigator : undefined) as Navigator | undefined;
  const ua = nav?.userAgent ?? null;
  const ref = typeof document !== "undefined" ? document.referrer || null : null;
  const cur = window.location?.href ?? null;
  const pn = window.location?.pathname ?? null;
  return { user_agent: ua, referer_url: ref, current_url: cur, pathname: pn };
}

async function flushQueue() {
  if (queue.length === 0) {
    timer = null;
    return;
  }
  const batch = queue.splice(0, Math.min(MAX_BATCH, queue.length));
  timer = null;
  try {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      queue.unshift(...batch);
      return;
    }
    const rows = batch.map((q) => q.payload);
    const { error } = await supabase.from("audit_event_logs").insert(rows as any[]);
    if (error) {
      // fail olanları geri al, retries sayısını artır; 3'ten fazla düşerse bırak
      for (const it of batch) {
        if (it.retries < 3) queue.push({ ...it, retries: it.retries + 1 });
      }
    }
  } catch {
    for (const it of batch) {
      if (it.retries < 3) queue.push({ ...it, retries: it.retries + 1 });
    }
  } finally {
    if (queue.length > 0 && timer === null) {
      timer = setTimeout(flushQueue, QUEUE_FLUSH_MS * 2);
    }
  }
}

/**
 * async olarak atar; beklemez, kuyruğa alır.
 * Kullanımı:  logAuditEvent({ event_kind: "presence", event_action: "presence_pulse", session_id })
 */
export function logAuditEvent(payload: AuditEventPayload): void {
  if (typeof window === "undefined") return;

  try {
    const env = pickClientEnvFields();
    const mergedMeta: Record<string, any> = {
      ...((payload.meta ?? {}) as Record<string, any>),
    };
    const base: AuditEventPayload = {
      status: payload.status ?? "ok",
      meta: mergedMeta,
      ...env,
      ...payload,
    };
    (base as any).meta = mergedMeta;
    const fullPayload: AuditEventPayload = base;
    queue.push({ payload: fullPayload, retries: 0 });
    if (timer === null) {
      timer = setTimeout(flushQueue, QUEUE_FLUSH_MS);
    }
  } catch {
    // sessizce yut; herhangi bir audit hatası UX'i kırmasın
  }
}

export async function flushAuditQueueNow(): Promise<void> {
  return new Promise((resolve) => {
    if (queue.length === 0) resolve();
    else setTimeout(() => flushQueue().finally(() => resolve()), 50);
  });
}
