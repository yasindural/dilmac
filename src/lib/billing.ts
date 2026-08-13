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

export const plans: Plan[] = [
  {
    id: "free",
    name: "Başlangıç",
    price: "Ücretsiz",
    period: "",
    note: "Dilmaç'ı denemek için",
    features: ["AI ile pratik sınırsız", "Canlı çeviri — lansman süresince sınırsız", "Tüm dil çiftleri"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₺149",
    period: "/ ay",
    note: "Düzenli görüşmeler için",
    features: ["Sınırsız canlı çeviri", "Karşılıklı sesli görüşme", "Görüşme geçmişi", "Öncelikli çeviri hızı"],
    highlight: true,
  },
  {
    id: "business",
    name: "Ekip",
    price: "₺399",
    period: "/ ay",
    note: "Küçük ekipler için",
    features: ["5 kullanıcıya kadar", "Ortak çalışma alanı", "Kullanım raporları", "Öncelikli destek"],
  },
];

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

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Ödeme altyapısı henüz bağlanmadı.");
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
        if (!paddle) { fail("Ödeme kitaplığı yüklenemedi. Sayfayı yenileyip tekrar deneyin."); return; }
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
          fail("Ödeme kitaplığı başlatılamadı. Anahtar ayarlarını kontrol edin.");
        }
      };
      script.onerror = () => fail("Ödeme sağlayıcısına ulaşılamadı. İnternet bağlantınızı kontrol edin.");
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
      throw new Error("Ödeme sayfası zamanında yanıt vermedi. Tekrar deneyin.");
    }
    throw new Error("Ödeme sağlayıcısına ulaşılamadı. İnternet bağlantınızı kontrol edin.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export type CheckoutRequest = { planId: PlanId; uid: string; email: string | null };

/** Seçilen plan için ödeme akışını başlatır. */
export async function startCheckout({ planId, uid, email }: CheckoutRequest): Promise<void> {
  const provider = billingProvider();
  if (provider === "none") throw new BillingNotConfiguredError();

  if (provider === "paddle") {
    const priceId = paddlePrices[planId];
    if (!priceId) throw new Error("Bu plan için fiyat tanımı eksik. (VITE_PADDLE_PRICE_* ayarlanmalı)");
    const paddle = await loadPaddle();
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      // Webhook bu uid ile planı sunucuya yazar; uygulama girişte doğrular.
      customData: { uid, planId },
      customer: email ? { email } : undefined,
      settings: { displayMode: "overlay", locale: "tr", theme: "dark" },
    });
    return;
  }

  const response = await fetchWithTimeout(endpoint as string, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, uid, email, returnTo: `${location.origin}${import.meta.env.BASE_URL}abonelik` }),
  });
  if (!response.ok) throw new Error("Ödeme sayfası açılamadı. Lütfen tekrar deneyin.");
  const payload = await response.json() as { url?: string };
  if (!payload.url) throw new Error("Ödeme sağlayıcısı geçerli bir adres döndürmedi.");
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
