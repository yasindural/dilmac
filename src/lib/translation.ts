import { logClientError } from "./errorLogger";

export type TranslationResult = { text: string; demo: boolean };

const CLIENT_TIMEOUT_MS = 21_000;
const demo: Record<string, string> = {
  merhaba: "Hello",
  "nasılsın": "How are you?",
  "bugün hava çok güzel": "The weather is beautiful today.",
  "teşekkür ederim": "Thank you.",
  "toplantı saat kaçta": "What time is the meeting?",
};

export async function translate(text: string, target: string, _legacyKey?: string): Promise<TranslationResult> {
  void _legacyKey;
  const apiBase = import.meta.env.VITE_DILMAC_API_URL?.replace(/\/$/, "");
  if (!apiBase) {
    const match = Object.entries(demo).find(([key]) => text.toLocaleLowerCase("tr").includes(key));
    return { text: match?.[1] || `[${target}] ${text}`, demo: true };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase}/translate`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target }),
    });
    if (!response.ok) {
      logClientError(`http_${response.status}`, "translation", "Çeviri servisi isteği başarısız");
      throw new Error("Çeviri servisine ulaşılamadı.");
    }
    const payload = await response.json();
    return { text: payload.text || "", demo: false };
  } catch (requestError) {
    const timedOut = requestError instanceof Error && requestError.name === "AbortError";
    logClientError(timedOut ? "request_timeout" : "network_error", "translation", requestError instanceof Error ? requestError.message : requestError);
    throw new Error(timedOut ? "Çeviri yanıtı gecikti. Tekrar deneyin." : "Çeviri servisine ulaşılamadı.");
  } finally {
    window.clearTimeout(timeout);
  }
}
