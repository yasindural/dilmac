import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider, siteLanguages, useI18n, type SiteLang } from "./i18n";
import { tr } from "../i18n/tr";
import { en } from "../i18n/en";
import { de } from "../i18n/de";
import { fr } from "../i18n/fr";
import { es } from "../i18n/es";
import { conversationLanguages } from "./languages";

const dictionaries: Record<SiteLang, Record<string, string>> = { tr, en, de, fr, es };

describe("site sözlükleri", () => {
  it("beş sözlük de aynı anahtar kümesine sahiptir", () => {
    const schema = Object.keys(tr).sort();
    expect(schema.length).toBeGreaterThan(200);
    for (const lang of Object.keys(dictionaries) as SiteLang[]) {
      expect(Object.keys(dictionaries[lang]).sort(), `${lang} anahtarları`).toEqual(schema);
    }
  });

  it("hiçbir dilde boş çeviri yoktur", () => {
    for (const lang of Object.keys(dictionaries) as SiteLang[]) {
      for (const [key, value] of Object.entries(dictionaries[lang])) {
        expect(value.trim(), `${lang}.${key} boş`).not.toBe("");
      }
    }
  });

  // Sessizce Türkçeye düşen anahtar üretime çıkmasın: Türkçe dışındaki bir
  // sözlükte Türkçe metnin birebir kopyası varsa çeviri unutulmuş demektir.
  // Marka adı, dil adları ve teknik terimler kasıtlı olarak aynıdır.
  it("çeviriler Türkçe metnin kopyası değildir", () => {
    const allowed = new Set([
      "lang.pick", "footer.privacy", "nav.home", "nav.about",
      "ai.badge", "ai.aiSide", "tour.next", "room.tourLabel",
      // Almancada birebir aynı yazılan gerçek kelimeler:
      "tour.s2t", "info.privacy.s1t", // Mikrofon
      "room.sizeNormal", // "Normal" beş dilde de aynı
    ]);
    const brandish = /^(Dilmaç|Pro|AI|Paddle|WebRTC|Türkçe|English|Deutsch|Français|Español)$/;
    for (const lang of ["en", "de", "fr", "es"] as const) {
      const copies = Object.keys(tr).filter((key) => {
        const source = tr[key as keyof typeof tr];
        return dictionaries[lang][key] === source
          && !allowed.has(key)
          && !brandish.test(source)
          && source.length > 3;
      });
      expect(copies, `${lang} çevrilmemiş anahtarlar`).toEqual([]);
    }
  });

  // Başlıktaki düğme dar bir alanda duruyor. Uzun bir çeviri girildiğinde
  // (ör. Fransızca "Démarrer la traduction en direct") düğme üç satıra
  // bölünüp logonun üstüne biniyordu. Kısa varyant kısa kalmalı.
  it("başlık düğmesi hiçbir dilde uzun değildir", () => {
    for (const lang of Object.keys(dictionaries) as SiteLang[]) {
      const label = dictionaries[lang]["cta.headerStart"];
      expect(label.length, `${lang} cta.headerStart çok uzun: "${label}"`).toBeLessThanOrEqual(20);
      // Sayfa içi tam cümle CTA'sı ayrı kalmalı, ikisi karışmamalı.
      expect(label).not.toBe(dictionaries[lang]["cta.start"]);
    }
  });

  // Başlık menüsündeki bağlantı adları da terzi işi: hepsi tek satırda
  // durmalı, yoksa 1280 px'lik dizüstünde satır taşar.
  it("menü bağlantı adları kısa kalır", () => {
    const navKeys = ["nav.home", "nav.how", "nav.features", "nav.try", "nav.pricing", "nav.about"] as const;
    for (const lang of Object.keys(dictionaries) as SiteLang[]) {
      for (const key of navKeys) {
        const label = dictionaries[lang][key];
        expect(label.length, `${lang}.${key} çok uzun: "${label}"`).toBeLessThanOrEqual(18);
      }
    }
  });

  it("desteklenen dil sayısı conversationLanguages ile aynıdır", () => {
    // Ana sayfa/SSS metinlerindeki sayı elle yazılmamalı; tek kaynak burasıdır.
    expect(conversationLanguages.length).toBe(20);
    for (const lang of Object.keys(dictionaries) as SiteLang[]) {
      const band = dictionaries[lang]["band.title"];
      expect(band, `${lang} band.title`).toContain("{count}");
    }
  });

  it("bütün yer tutucular her dilde korunur", () => {
    const placeholders = (value: string) =>
      Array.from(value.matchAll(/\{([^}]+)\}/g), (match) => match[1]).sort();
    for (const key of Object.keys(tr)) {
      const expected = placeholders(tr[key as keyof typeof tr]);
      for (const lang of ["en", "de", "fr", "es"] as const) {
        expect(
          placeholders(dictionaries[lang][key]),
          `${lang}.${key} yer tutucuları`,
        ).toEqual(expected);
      }
    }
  });

  it("dillerin hitap biçimi tutarlı kalır", () => {
    const words = (value: string) => value.match(/\p{L}+/gu) ?? [];
    const germanFormal = new Set(["Sie", "Ihnen", "Ihr", "Ihre", "Ihrem", "Ihren", "Ihrer", "Ihres"]);
    const frenchInformal = new Set(["tu", "toi", "te", "ta", "tes"]);
    const spanishVosotros = new Set([
      "vosotros", "vosotras", "vuestro", "vuestra", "vuestros", "vuestras",
      "estáis", "sois", "tenéis", "podéis", "hablad", "entendeos",
    ]);

    for (const [key, value] of Object.entries(de)) {
      expect(words(value).filter((word) => germanFormal.has(word)), `de.${key} resmî hitap`).toEqual([]);
    }
    for (const [key, value] of Object.entries(fr)) {
      expect(words(value).filter((word) => frenchInformal.has(word.toLowerCase())), `fr.${key} samimi hitap`).toEqual([]);
      expect(value, `fr.${key} samimi kısaltılmış hitap`).not.toMatch(/\bt['’]/iu);
    }
    for (const [key, value] of Object.entries(es)) {
      expect(words(value).filter((word) => spanishVosotros.has(word.toLowerCase())), `es.${key} vosotros hitabı`).toEqual([]);
    }
  });
});

function Probe() {
  const { lang, setLang, t } = useI18n();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="home">{t("nav.home")}</span>
      <span data-testid="param">{t("notice.connecting", { room: "ABC123" })}</span>
      {siteLanguages.map(([code]) => (
        <button key={code} onClick={() => setLang(code)}>{`set-${code}`}</button>
      ))}
    </div>
  );
}

describe("I18nProvider davranışı", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.lang = ""; });
  afterEach(() => cleanup());

  it("dil seçimini localStorage'da saklar ve html lang'i günceller", () => {
    render(<MemoryRouter><I18nProvider><Probe /></I18nProvider></MemoryRouter>);
    act(() => { screen.getByText("set-de").click(); });
    expect(screen.getByTestId("lang").textContent).toBe("de");
    expect(localStorage.getItem("dilmac-site-lang")).toBe("de");
    expect(document.documentElement.lang).toBe("de");
  });

  it("dil değişimi metni sayfa yenilemeden günceller", () => {
    render(<MemoryRouter><I18nProvider><Probe /></I18nProvider></MemoryRouter>);
    const before = screen.getByTestId("home").textContent;
    act(() => { screen.getByText("set-fr").click(); });
    expect(screen.getByTestId("home").textContent).not.toBe(before);
    expect(screen.getByTestId("home").textContent).toBe(fr["nav.home"]);
  });

  it("parametreli metinleri doldurur", () => {
    render(<MemoryRouter><I18nProvider><Probe /></I18nProvider></MemoryRouter>);
    expect(screen.getByTestId("param").textContent).toContain("ABC123");
    expect(screen.getByTestId("param").textContent).not.toContain("{room}");
  });
});
