"use client";

import { useEffect } from "react";

const RETURN_TO_BANK_LIST_FLAG = "bank-page:return-to-list";

export function BankPageBackGuard() {
  useEffect(() => {
    const handlePopState = () => {
      try {
        window.sessionStorage.setItem(RETURN_TO_BANK_LIST_FLAG, "1");
      } catch {
        /* ignore sessionStorage errors */
      }

      window.location.replace("/banken");
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
}
