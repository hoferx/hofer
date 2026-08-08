import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function pickIp(headers: Headers): string | null {
  const h1 = headers.get("x-forwarded-for");
  if (h1) return h1.split(",")[0].trim();
  const h2 = headers.get("cf-connecting-ip") || headers.get("x-real-ip");
  return h2 || null;
}

export async function POST(request: Request) {
  const headers = request.headers;
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.sessionId || body?.session_id || "").trim();
  const publicId = body?.publicId || body?.public_id || null;
  const pathname = typeof body?.pathname === "string" ? body.pathname.slice(0, 500) : null;
  const currentStep = typeof body?.currentStep === "string" ? body.currentStep.slice(0, 80) : null;
  const desiredStatus =
    body?.status === "offline" ? "offline"
    : body?.status === "online" ? "online"
    : null;

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SERVICE_ROLE, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cs: any[]) {
        try { cs.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options)); } catch { /* noop */ }
      },
    },
  });

  const now = new Date().toISOString();
  const patch: any = { last_ping_at: now };

  if (desiredStatus === "online") {
    patch.status = "online";
  } else if (desiredStatus === "offline") {
    patch.status = "offline";
  } else {
    // Default: ping ONLINE
    patch.status = "online";
  }

  if (currentStep && !patch.current_step) {
    patch.current_step = currentStep;
  }

  if (publicId) patch.public_id = String(publicId);
  if (pathname) patch.last_pathname = pathname;
  else {
    const ref = headers.get("referer");
    if (ref) patch.last_pathname = ref.slice(0, 500);
  }

  const ip = pickIp(headers);
  if (ip) patch.ip_address = ip;

  try {
    const { error } = await supabase.from("sessions").update(patch).eq("id", sessionId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code ?? null }, { status: 500 });
    }
    // Ekstra savunma: status = 'online' olan ama last_ping_at > 90sn önceki satırları topluca offline yap
    try {
      await supabase
        .from("sessions")
        .update({ status: "offline" })
        .eq("status", "online")
        .lt("last_ping_at", new Date(Date.now() - 90 * 1000).toISOString());
    } catch { /* sessizce */ }

    return NextResponse.json({ ok: true, status: patch.status, ping_at: now });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
