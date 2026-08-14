import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider, type SiteLang } from "./lib/i18n";
import { App } from "./App";
import { conversationLanguages } from "./lib/languages";
import { tr } from "./i18n/tr";
import { en } from "./i18n/en";
import { de } from "./i18n/de";
import { fr } from "./i18n/fr";
import { es } from "./i18n/es";

// Türkçeye özgü harf + Türkçe sözlükten gelen belirteç cümleler. Bilerek
// çevrilmeyen içerikler (marka, dil adları, iki dilli demo cümleleri,
// e-posta) yanlış pozitif üretmesin diye ayıklanır.
const TURKISH_MARKERS = [
  tr["lobby.create"], tr["room.speak"], tr["gate.register"],
  tr["auth.submitRegister"], tr["sub.compareTitle"], tr["prof.quickTitle"],
  tr["nf.title"], tr["info.terms.s1t"], tr["info.refund.s2t"],
];

const DEMO_ALLOWED = [
  "Türkçe", "Dilmaç", "Yarınki toplantı saat kaçta?", "Saat onda başlıyor.",
];

function renderAt(path: string, lang: SiteLang) {
  localStorage.setItem("dilmac-site-lang", lang);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider><App /></I18nProvider>
    </MemoryRouter>,
  );
}

function bodyTextWithoutDemos() {
  let text = document.body.innerText || document.body.textContent || "";
  for (const allowed of DEMO_ALLOWED) text = text.split(allowed).join(" ");
  return text;
}

const ROUTES = [
  "/", "/nasil-calisir", "/ozellikler", "/deneme", "/abonelik",
  "/hakkinda", "/kayit", "/profil", "/gizlilik", "/kullanim-sartlari",
  "/iade-politikasi", "/iletisim", "/uygulama", "/bilinmeyen-sayfa",
];

describe("rota yerelleştirmesi", () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it.each(ROUTES)("%s rotası İngilizcede Türkçe metin göstermez", (route) => {
    renderAt(route, "en");
    const text = bodyTextWithoutDemos();
    // ç/ö/ü diğer desteklenen dillerde ve dil endonimlerinde de geçer;
    // ğ/ı/İ/ş ise bu arayüz bağlamında Türkçe sızıntısını güvenle yakalar.
    expect(text, `${route} içinde Türkçeye özgü karakter kaldı`).not.toMatch(/[ğıİşŞ]/);
    for (const marker of TURKISH_MARKERS) {
      expect(text, `${route} içinde "${marker}" kaldı`).not.toContain(marker);
    }
  });

  // Almanca, Fransızca ve İspanyolca için rota kapsamını temsil eden örnekler.
  const SAMPLE_ROUTES = ["/", "/abonelik", "/kayit", "/uygulama", "/kullanim-sartlari"];
  it.each(
    (["de", "fr", "es"] as const).flatMap((lang) => SAMPLE_ROUTES.map((route) => [lang, route] as const)),
  )("%s dilinde %s rotası Türkçe kalmaz", (lang, route) => {
    renderAt(route, lang);
    const text = bodyTextWithoutDemos();
    for (const marker of TURKISH_MARKERS) {
      expect(text, `${lang} ${route} içinde "${marker}" kaldı`).not.toContain(marker);
    }
  });

  it("dile göre gerçekten o dilin metnini gösterir", () => {
    const dict = { en, de, fr, es } as const;
    for (const lang of ["en", "de", "fr", "es"] as const) {
      cleanup();
      renderAt("/abonelik", lang);
      expect(screen.getByText(dict[lang]["sub.compareTitle"])).toBeInTheDocument();
    }
  });

  it("erişilebilirlik etiketleri de yerelleşir", () => {
    renderAt("/", "de");
    // Marka bağlantısı başlıkta ve altbilgide iki kez bulunur.
    expect(screen.getAllByLabelText(de["a11y.brand"]).length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: de["a11y.mainNav"] })).toBeInTheDocument();
  });

  it("desteklenen dil sayısı her yerde conversationLanguages.length ile aynıdır", () => {
    const count = String(conversationLanguages.length);
    renderAt("/abonelik", "en");
    const table = document.querySelector(".compare table");
    expect(table).not.toBeNull();
    const row = within(table as HTMLElement).getByText(en["sub.r3"]).closest("tr");
    const cells = Array.from(row!.querySelectorAll("td")).map((cell) => cell.textContent);
    expect(cells).toEqual([count, count, count]);
    // Eski sabit "7" hiçbir yerde kalmamalı
    expect(table!.textContent).not.toContain(">7<");
  });

  it("plan adları site diline göre değişir, kimlikler değişmez", () => {
    cleanup();
    renderAt("/abonelik", "fr");
    expect(screen.getAllByText(fr["plan.business.name"]).length).toBeGreaterThan(0);
    cleanup();
    renderAt("/abonelik", "es");
    expect(screen.getAllByText(es["plan.business.name"]).length).toBeGreaterThan(0);
  });
});

// Uzun Almanca/Fransızca metinlerin düzeni bozup bozmadığı görsel bir konudur;
// burada yalnızca metnin gerçekten uzun olduğunu ve boş kalmadığını doğruluyoruz.
describe("uzun metin kontrolü", () => {
  it("Almanca ve Fransızca metinler boş değildir", () => {
    for (const key of ["sub.sub", "info.terms.s1b", "gate.liveText"] as const) {
      expect(de[key].length).toBeGreaterThan(20);
      expect(fr[key].length).toBeGreaterThan(20);
    }
  });
});

vi.mock("./lib/auth", async () => {
  const actual = await vi.importActual<typeof import("./lib/auth")>("./lib/auth");
  return { ...actual, authReady: false };
});
