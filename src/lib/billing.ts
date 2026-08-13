// Ödeme altyapısı — sağlayıcı bağlanmaya hazır iskelet.
//
// Uygulamanın geri kalanı ödeme sağlayıcısını hiç bilmez; yalnızca bu dosyadaki
// startCheckout / openBillingPortal fonksiyonlarını çağırır. Sağlayıcı
// bağlandığında (iyzico, PayTR, Stripe, Paddle…) sadece burası değişir.
//
// BAĞLAMAK İÇİN:
//   1. VITE_BILLING_URL ortam değişkenine checkout başlatan uç noktayı yaz.
//      Uç nokta { planId, uid, email } alıp { url } döndürmeli.
//   2. Sağlayıcının webhook'u ödeme onaylanınca kullanıcının planını yükseltmeli.
//   3. Başka hiçbir dosyaya dokunmak gerekmez.

import type { PlanId } from "./access";

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

export const billingConfigured = Boolean(import.meta.env.VITE_BILLING_URL);

export type CheckoutRequest = { planId: PlanId; uid: string; email: string | null };

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Ödeme altyapısı henüz bağlanmadı.");
    this.name = "BillingNotConfiguredError";
  }
}

/** Sağlayıcının ödeme sayfasına yönlendirir. */
export async function startCheckout({ planId, uid, email }: CheckoutRequest): Promise<void> {
  const endpoint = import.meta.env.VITE_BILLING_URL;
  if (!endpoint) throw new BillingNotConfiguredError();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, uid, email, returnTo: `${location.origin}${import.meta.env.BASE_URL}abonelik` }),
  });
  if (!response.ok) throw new Error("Ödeme sayfası açılamadı. Lütfen tekrar deneyin.");
  const payload = await response.json() as { url?: string };
  if (!payload.url) throw new Error("Ödeme sağlayıcısı geçerli bir adres döndürmedi.");
  location.assign(payload.url);
}

/** Aboneliği yönetme (iptal, kart değiştirme) ekranı. */
export async function openBillingPortal(uid: string): Promise<void> {
  const endpoint = import.meta.env.VITE_BILLING_URL;
  if (!endpoint) throw new BillingNotConfiguredError();
  location.assign(`${endpoint.replace(/\/$/, "")}/portal?uid=${encodeURIComponent(uid)}`);
}
