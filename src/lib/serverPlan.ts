import type { PlanId } from "./access";

// Kullanıcının GERÇEK planı sunucuda tutulur: ödeme sağlayıcısının webhook'u
// planı yazar, uygulama girişte buradan doğrular. Cihazdaki localStorage
// yalnızca sunucuya ulaşılamadığında geçerli olan yedektir; böylece
// localStorage'ı elle değiştiren biri kalıcı abonelik kazanamaz.
export async function fetchServerPlan(uid: string): Promise<PlanId | null> {
  const apiBase = import.meta.env.VITE_DILMAC_API_URL?.replace(/\/$/, "");
  if (!apiBase || !uid) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${apiBase}/plan`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { plan?: string | null };
    return payload.plan === "pro" || payload.plan === "business" || payload.plan === "free"
      ? payload.plan
      : null;
  } catch {
    // Ağ hatası plan kontrolünü engellememeli; cihazdaki değer kullanılır.
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
