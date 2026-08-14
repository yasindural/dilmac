// Ödeme altyapısı — sağlayıcıdan bağımsız katman.
//
// Uygulamanın geri kalanı yalnızca startCheckout / billingProvider bilir.
// Desteklenen sağlayıcılar:
//
//   1. PADDLE (önerilen) — ortam değişkenlerini doldur, başka şey gerekmez:
//        VITE_PADDLE_CLIENT_TOKEN = Paddle > Developer Tools > Client-side token
//        VITE_PADDLE_PRICE_PRO      = pri_... (Pro planın fiyat kimliği)
//        VITE_PADDLE_PRICE_BUSINESS = pri_... (Ekip planın fiyat kimliği)
//        VITE_PADDLE_ENV = sandbox | production   (test için sandbox)
//      Ödeme onaylanınca Paddle webhook'u Cloudflare Worker'daki
//      /billing/webhook ucuna düşer ve kullanıcının planı sunucuya yazılır.
//      Worker tarafında gerekli secret'lar:
//        wrangler secret put PADDLE_WEBHOOK_SECRET
//        wrangler secret put PADDLE_PRICE_PRO
//        wrangler secret put PADDLE_PRICE_BUSINESS
//
//   2. ENDPOINT — kendi checkout API'n varsa:
//        VITE_BILLING_URL = { planId, uid, email } alıp { url } döndüren uç.
//
// Hiçbiri tanımlı değilse uygulama "demo" kipinde çalışır: plan seçimi
// yalnızca cihaza yazılır, ödeme alınmaz.

import type { PlanId } from "./access";
import type { TranslationKey } from "./i18n";
import { logClientError } from "./errorLogger";

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  note: string;
  features: string[];
  highlight?: boolean;
};

// İŞ MANTIĞI ile GÖRÜNEN METİN ayrıdır. Kimlikler, fiyatlar ve Paddle fiyat
// kimlikleri burada sabittir; kullanıcıya gösterilen ad/açıklama/özellikler
// sözlükten gelir (bkz. localizedPlans). Böylece plan hakları hiçbir dilde
// değişmez.
export type PlanShape = {
  id: PlanId;
  price: string;
  featureCount: number;
  highlight?: boolean;
};

export const planShapes: PlanShape[] = [
  { id: "free", price: "Ücretsiz", featureCount: 3 },
  { id: "pro", price: "₺149", featureCount: 4, highlight: true },
  { id: "business", price: "₺399", featureCount: 4 },
];

// Tip-only import: çalışma zamanında döngü oluşmaz.
type PlanTranslate = (key: TranslationKey) => string;

/** Plan listesini seçili site diliyle üretir. Kimlik ve fiyat değişmez. */
export function localizedPlans(t: PlanTranslate): Plan[] {
  return planShapes.map((shape) => ({
    id: shape.id,
    name: t(`plan.${shape.id}.name` as TranslationKey),
    price: shape.id === "free" ? t("plan.free.price") : shape.price,
    period: shape.id === "free" ? "" : t("plan.period"),
    note: t(`plan.${shape.id}.note` as TranslationKey),
    features: Array.from({ length: shape.featureCount }, (_, index) => t(`plan.${shape.id}.f${index + 1}` as TranslationKey)),
    highlight: shape.highlight,
  }));
}

export type BillingProvider = "none" | "endpoint" | "paddle";

const paddleToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
const paddleSandbox = (import.meta.env.VITE_PADDLE_ENV as string | undefined) === "sandbox";
const paddlePrices: Partial<Record<PlanId, string | undefined>> = {
  pro: import.meta.env.VITE_PADDLE_PRICE_PRO as string | undefined,
  business: import.meta.env.VITE_PADDLE_PRICE_BUSINESS as string | undefined,
};
const endpoint = import.meta.env.VITE_BILLING_URL as string | undefined;

export function billingProvider(): BillingProvider {
  if (paddleToken) return "paddle";
  if (endpoint) return "endpoint";
  return "none";
}

export const billingConfigured = billingProvider() !== "none";

/** Mesajı bir çeviri anahtarıdır; arayüz t() ile yerelleştirir. */
export class BillingError extends Error {
  constructor(public readonly translationKey: string) {
    super(translationKey);
    this.name = "BillingError";
  }
}

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("billing.notConfigured");
    this.name = "BillingNotConfiguredError";
  }
}

type PaddleJS = {
  Environment: { set: (env: "sandbox" | "production") => void };
  Initialize: (options: { token: string; eventCallback?: (event: { name?: string; type?: string; code?: string; detail?: unknown; error?: unknown }) => void }) => void;
  Checkout: { open: (options: unknown) => void };
};

declare global {
  interface Window { Paddle?: PaddleJS }
}

let paddleLoader: Promise<PaddleJS> | null = null;

/** Paddle'ın resmi betiğini bir kez yükleyip başlatır. */
function loadPaddle(): Promise<PaddleJS> {
  if (!paddleLoader) {
    paddleLoader = new Promise<PaddleJS>((resolve, reject) => {
      const fail = (message: string) => {
        paddleLoader = null; // sonraki denemede yeniden yüklenebilsin
        reject(new Error(message));
      };
      const script = document.createElement("script");
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.async = true;
      script.onload = () => {
        const paddle = window.Paddle;
        if (!paddle) { fail("billing.scriptFailed"); return; }
        try {
          if (paddleSandbox) paddle.Environment.set("sandbox");
          paddle.Initialize({
            token: paddleToken as string,
            // Checkout içinde bir şey ters giderse gerçek sebebi kayda yaz;
            // "Something went wrong" ekranı sebebi söylemiyor.
            eventCallback: (event) => {
              const name = event?.name || event?.type || "";
              if (/error|failed/i.test(String(name)) || event?.error) {
                logClientError(
                  String(name || "checkout_error"),
                  "billing",
                  JSON.stringify({ code: event?.code, detail: event?.detail, error: event?.error }).slice(0, 280),
                );
              }
            },
          });
          resolve(paddle);
        } catch {
          fail("billing.initFailed");
        }
      };
      script.onerror = () => fail("billing.unreachable");
      document.head.appendChild(script);
    });
  }
  return paddleLoader;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (requestError) {
    if (requestError instanceof Error && requestError.name === "AbortError") {
      throw new BillingError("billing.timeout");
    }
    throw new BillingError("billing.unreachable");
  } finally {
    window.clearTimeout(timeout);
  }
}

export type CheckoutRequest = { planId: PlanId; uid: string; email: string | null; locale?: string };

// Paddle Checkout'un desteklediği yerel ayarlar. Listede olmayan bir değer
// gönderilirse Paddle hata verebilir; bu yüzden bilinmeyen dil "en"e düşer.
// Checkout item, fiyat kimliği, customData ve kullanıcı kimliği DEĞİŞMEZ.
const paddleLocales = new Set(["en", "de", "es", "fr", "it", "nl", "pl", "pt", "ru", "sv", "tr", "zh", "ja", "ko", "da", "no", "fi", "cs", "el", "he", "id", "th", "uk", "ar"]);

function safePaddleLocale(locale?: string) {
  const base = (locale || "").slice(0, 2).toLowerCase();
  return paddleLocales.has(base) ? base : "en";
}

/** Seçilen plan için ödeme akışını başlatır. */
export async function startCheckout({ planId, uid, email, locale }: CheckoutRequest): Promise<void> {
  const provider = billingProvider();
  if (provider === "none") throw new BillingNotConfiguredError();

  if (provider === "paddle") {
    const priceId = paddlePrices[planId];
    if (!priceId) throw new BillingError("billing.missingPrice");
    const paddle = await loadPaddle();
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      // Webhook bu uid ile planı sunucuya yazar; uygulama girişte doğrular.
      customData: { uid, planId },
      customer: email ? { email } : undefined,
      settings: { displayMode: "overlay", locale: safePaddleLocale(locale), theme: "dark" },
    });
    return;
  }

  const response = await fetchWithTimeout(endpoint as string, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, uid, email, returnTo: `${location.origin}${import.meta.env.BASE_URL}abonelik` }),
  });
  if (!response.ok) throw new BillingError("billing.openFailed");
  const payload = await response.json() as { url?: string };
  if (!payload.url) throw new BillingError("billing.badUrl");
  location.assign(payload.url);
}

/** Aboneliği yönetme (iptal, kart değiştirme). Paddle'da bu bağlantı e-postayla gelir. */
export async function openBillingPortal(uid: string): Promise<void> {
  const provider = billingProvider();
  if (provider === "endpoint") {
    location.assign(`${(endpoint as string).replace(/\/$/, "")}/portal?uid=${encodeURIComponent(uid)}`);
    return;
  }
  throw new BillingNotConfiguredError();
}
