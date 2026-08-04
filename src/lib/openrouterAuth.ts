const verifierKey = "dilmac-openrouter-verifier";
const returnKey = "dilmac-openrouter-return";

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function connectOpenRouter(returnTo: string) {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const callback = `${location.origin}${import.meta.env.BASE_URL}openrouter-callback`;
  sessionStorage.setItem(verifierKey, verifier);
  sessionStorage.setItem(returnKey, returnTo);
  location.assign(`https://openrouter.ai/auth?callback_url=${encodeURIComponent(callback)}&code_challenge=${base64Url(new Uint8Array(digest))}&code_challenge_method=S256`);
}

export async function finishOpenRouter(code: string) {
  const verifier = sessionStorage.getItem(verifierKey);
  if (!verifier) throw new Error("OpenRouter doğrulama oturumu bulunamadı.");
  const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
  });
  if (!response.ok) throw new Error("OpenRouter bağlantısı tamamlanamadı.");
  const data = await response.json() as { key?: string };
  if (!data.key) throw new Error("OpenRouter anahtarı alınamadı.");
  sessionStorage.setItem("dilmac-key", data.key);
  sessionStorage.removeItem(verifierKey);
  return sessionStorage.getItem(returnKey) || "/uygulama";
}
