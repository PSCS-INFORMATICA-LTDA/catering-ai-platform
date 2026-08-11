"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getWhatsappShareMessage, tShare } from "@/Lib/i18n/share";
import { useAuthLocaleFromMe } from "@/Lib/i18n/useAuthLocaleFromMe";

const WHATSAPP_PHONE = "14079152242";

export default function FloatingWhatsAppButton() {
  const pathname = usePathname();
  const locale = useAuthLocaleFromMe();
  const isQuoteWizard = pathname.includes("/quotes/new");
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const key = `whatsapp_hint_seen_${pathname || "home"}`;
    const alreadySeen = sessionStorage.getItem(key);

    if (alreadySeen) return;

    const showTimer = window.setTimeout(() => {
      setShowHint(true);
      sessionStorage.setItem(key, "true");
    }, 1000);

    const hideTimer = window.setTimeout(() => {
      setShowHint(false);
    }, 5000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [pathname]);

  const whatsappUrl = useMemo(() => {
    const message = getWhatsappShareMessage(locale, pathname || "");
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
  }, [pathname, locale]);

  return (
    <div
      className={`no-print fixed ${isQuoteWizard ? "z-40" : "z-[9999]"} md:bottom-6 md:right-5`}
      style={{
        right: "12px",
        bottom: isQuoteWizard
          ? "calc(env(safe-area-inset-bottom) + 12px)"
          : "calc(env(safe-area-inset-bottom) + 82px)",
      }}
    >
      {showHint && (
        <div className="pointer-events-none absolute bottom-16 right-0 mb-2 w-[210px] rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-medium leading-snug text-white shadow-xl">
          {tShare(locale, "hint")}
        </div>
      )}

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={tShare(locale, "talkOnWhatsApp")}
        title={tShare(locale, "talkOnWhatsApp")}
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-green-500/30 transition hover:scale-105 active:scale-95 md:h-[58px] md:w-[58px]"
      >
        <MessageCircle className="h-8 w-8" strokeWidth={2.7} />
      </a>
    </div>
  );
}
