import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Gerekli izin: SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı ki anon tarayıcı INSERT'inde
// RLS'den bağımsız olarak garanti şekilde yazalım.
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const arr: unknown[] = Array.isArray(raw) ? raw : [raw];
    if (arr.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 }, { status: 200 });
    }
    if (arr.length > 200) {
      return NextResponse.json({ error: 'batch too large (> 200)' }, { status: 413 });
    }

    let ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
    const userAgent = request.headers.get('user-agent') || null;
    const country = request.headers.get('cf-ipcountry') || null;
    const city = request.headers.get('cf-ipcity') || null;
    const referer = request.headers.get('referer') || null;

    const cookieStore = await cookies();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cs: any[]) {
          try { cs.forEach(({ name, value, options }: any) => cookieStore.set(name, value, options)); } catch { /* ignore */ }
        },
      },
    });

    const normalizeRow = (row: any) => {
      if (!row || typeof row !== 'object') return null;
      const out: Record<string, any> = { ...row };
      // Sunucu tarafından doğrulanan / overwrite edilen alanlar:
      if (ip && (!out.user_ip || String(out.user_ip || '').length < 5)) out.user_ip = ip;
      if (userAgent && (!out.user_agent || String(out.user_agent || '').length < 5)) out.user_agent = userAgent;
      if (country && !out.country) out.country = country;
      if (city && !out.city) out.city = city;
      if (referer && !out.referer_url) out.referer_url = referer;
      // Uzunluk sınırları
      const max255 = ['public_id', 'partner_name', 'status', 'event_kind', 'event_action', 'from_step', 'to_step', 'pathname', 'bank_slug', 'bank_name', 'login_method', 'admin_email', 'admin_action', 'country', 'city', 'error_name'];
      for (const k of max255) {
        if (typeof out[k] === 'string' && out[k].length > 255) out[k] = out[k].slice(0, 255);
      }
      for (const k of ['user_ip', 'referer_url', 'current_url']) {
        if (typeof out[k] === 'string' && out[k].length > 8192) out[k] = out[k].slice(0, 8192);
      }
      if (typeof out.user_agent === 'string' && out.user_agent.length > 1500) out.user_agent = out.user_agent.slice(0, 1500);
      if (typeof out.error_message === 'string' && out.error_message.length > 2000) out.error_message = out.error_message.slice(0, 2000);
      if (out.meta && typeof out.meta === 'object') {
        try { out.meta = JSON.parse(JSON.stringify(out.meta)); } catch { out.meta = null; }
      } else if (out.meta !== null && out.meta !== undefined) {
        out.meta = { raw: String(out.meta) };
      } else {
        out.meta = {};
      }
      if (!out.created_at) delete out.created_at; // DB'den default gelsin
      return out;
    };

    const rows = arr.map(normalizeRow).filter(Boolean);
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 }, { status: 200 });
    }

    // RLS'den kaçmak için service role varsa auth.uid bypass kullan. Yoksa normal insert dene.
    const { error } = await supabase.from('audit_event_logs').insert(rows as any[]);
    if (error) {
      // Tek seferde dene tek tek (sırayla hatalı row varsa onları atla)
      let okCount = 0;
      let firstErr: any = null;
      for (const r of rows) {
        try {
          const { error: e2 } = await supabase.from('audit_event_logs').insert(r as any);
          if (!e2) okCount++; else if (!firstErr) firstErr = e2;
        } catch (e) { if (!firstErr) firstErr = e; }
      }
      if (firstErr && okCount === 0) {
        console.error('[audit/log] insert error', firstErr);
        return NextResponse.json({ error: firstErr?.message || String(firstErr) }, { status: 500 });
      }
      return NextResponse.json({ ok: true, inserted: okCount, partial: true, firstError: firstErr?.message || null }, { status: 207 });
    }
    return NextResponse.json({ ok: true, inserted: rows.length, from_server: { ip, country, city } }, { status: 200 });
  } catch (error: any) {
    console.error('[audit/log] fatal', error);
    return NextResponse.json({ error: error?.message || 'Unexpected' }, { status: 500 });
  }
}
