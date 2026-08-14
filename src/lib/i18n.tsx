import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { tr } from "../i18n/tr";
import { en } from "../i18n/en";
import { de } from "../i18n/de";
import { fr } from "../i18n/fr";
import { es } from "../i18n/es";

// Site ARAYÜZ dilleri. Konuşma/çeviri dilleriyle karıştırılmamalı: onlar
// src/lib/languages.ts içindeki 20 dildir ve ayrı bir kavramdır.
// İlk açılışta tarayıcı diline bakılır; kullanıcının seçimi localStorage'da
// saklanır.
export const siteLanguages = [
  ["tr", "Türkçe"],
  ["en", "English"],
  ["de", "Deutsch"],
  ["fr", "Français"],
  ["es", "Español"],
] as const;

export type SiteLang = (typeof siteLanguages)[number][0];

// Türkçe sözlük şemadır; diğer diller aynı anahtarların tamamını sağlamak
// zorundadır (bkz. src/i18n/*.ts içindeki `satisfies Dictionary`).
export type TranslationKey = keyof typeof tr;
export type Dictionary = Record<TranslationKey, string>;

const dictionaries: Record<SiteLang, Dictionary> = { tr, en, de, fr, es };

export function detectSiteLang(): SiteLang {
  try {
    const saved = localStorage.getItem("dilmac-site-lang");
    if (saved && siteLanguages.some(([code]) => code === saved)) return saved as SiteLang;
  } catch { /* gizli modda localStorage kapalı olabilir */ }
  const nav = (typeof navigator !== "undefined" ? navigator.language || "" : "").toLowerCase();
  const match = siteLanguages.find(([code]) => nav === code || nav.startsWith(`${code}-`));
  return (match?.[0] as SiteLang) || "tr";
}

// Basit ve geriye dönük uyumlu parametre desteği: t("room.peer", { name: "…" })
// metindeki {name} yer tutucusunu doldurur. Parametre verilmezse davranış
// eskisiyle birebir aynıdır.
export type TranslateParams = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: TranslateParams) => string;

function format(template: string, params?: TranslateParams) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}

type I18nValue = {
  lang: SiteLang;
  setLang: (lang: SiteLang) => void;
  t: Translate;
};

const defaultValue: I18nValue = {
  lang: "tr",
  setLang: () => undefined,
  t: (key, params) => format(tr[key] ?? key, params),
};

const I18nContext = createContext<I18nValue>(defaultValue);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<SiteLang>(detectSiteLang);
  const value = useMemo<I18nValue>(() => ({
    lang,
    setLang: (next: SiteLang) => {
      setLangState(next);
      try { localStorage.setItem("dilmac-site-lang", next); } catch { /* yoksay */ }
    },
    // Eksik anahtar üretime çıkarsa çökmek yerine Türkçeye düşer; testler bu
    // durumun hiç oluşmadığını ayrıca doğrular.
    t: (key, params) => format(dictionaries[lang][key] ?? tr[key] ?? key, params),
  }), [lang]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
