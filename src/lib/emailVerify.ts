// E-posta doğrulama: 6 haneli kod akışının istemci tarafı.
// Sunucuda Resend anahtarı yoksa veya gönderim başarısız olursa çağıran
// taraf "link-fallback" görür ve Firebase'in bağlantılı doğrulamasına düşer;
// kullanıcı hiçbir durumda kilitli kalmaz.

const apiBase = () => import.meta.env.VITE_DILMAC_API_URL?.replace(/\/$/, "") || "";

export type SendCodeResult = "sent" | "cooldown" | "link-fallback";
export type VerifyCodeResult = "ok" | "invalid" | "expired" | "too-many" | "failed";

export async function sendVerificationCode(uid: string, email: string): Promise<SendCodeResult> {
  const base = apiBase();
  if (!base || !email) return "link-fallback";
  try {
    const response = await fetch(`${base}/auth/send-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, email }),
    });
    if (response.ok) return "sent";
    if (response.status === 429) return "cooldown";
    return "link-fallback";
  } catch {
    return "link-fallback";
  }
}

export async function verifyEmailCode(uid: string, code: string): Promise<VerifyCodeResult> {
  const base = apiBase();
  if (!base) return "failed";
  try {
    const response = await fetch(`${base}/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, code }),
    });
    if (response.ok) return "ok";
    const payload = await response.json().catch(() => ({}));
    if (payload.error === "code_expired") return "expired";
    if (payload.error === "too_many_attempts") return "too-many";
    if (payload.error === "code_invalid") return "invalid";
    return "failed";
  } catch {
    return "failed";
  }
}

/** Kodla daha önce doğrulanmış hesap: girişte panel tekrar çıkmasın. */
export async function isCodeVerified(uid: string): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  try {
    const response = await fetch(`${base}/auth/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return Boolean(payload.verified);
  } catch {
    return false;
  }
}
