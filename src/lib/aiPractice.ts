export type PracticeHistoryTurn = {
  userText: string;
  userTranslation: string;
  reply: string;
  replyTranslation: string;
};

export type PracticeReply = Omit<PracticeHistoryTurn, "userText">;

type PracticeRequest = {
  text: string;
  userLanguage: string;
  partnerLanguage: string;
  history: PracticeHistoryTurn[];
  key?: string;
};

const cleanJson = (value: string) => value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

export async function practiceWithAi({ text, userLanguage, partnerLanguage, history, key }: PracticeRequest): Promise<PracticeReply> {
  const apiBase = import.meta.env.VITE_DILMAC_API_URL?.replace(/\/$/, "");
  if (!apiBase) {
    return {
      userTranslation: `[${partnerLanguage}] ${text}`,
      reply: `Hello! I understood: ${text}`,
      replyTranslation: `Merhaba! Söylediğinizi anladım: ${text}`,
    };
  }

  const recentContext = history.slice(-6).map((turn) => ({
    user: turn.userTranslation,
    assistant: turn.reply,
  }));
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  let response: Response;
  try {
    response = await fetch(`${apiBase}/practice`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, userLanguage, partnerLanguage, history: recentContext }),
    });
  } catch (requestError) {
    if (requestError instanceof DOMException && requestError.name === "AbortError") {
      throw new Error("AI yanıtı gecikti ve güvenli biçimde durduruldu. Mikrofon açık; sonraki cümleyle devam edebilirsiniz.");
    }
    throw requestError;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(response.status === 402
      ? "Ücretli ve ücretsiz AI modellerinin kullanım sınırı dolu. Biraz sonra tekrar deneyin."
      : response.status === 429
        ? "Ücretsiz AI modeli şu an yoğun. Mikrofon açık kalacak; birkaç saniye sonra yeniden konuşabilirsiniz."
        : "AI deneme servisine ulaşılamadı. Mikrofon açık; birkaç saniye sonra tekrar deneyin.");
  }

  const payload = await response.json();
  const raw = payload.content;
  if (typeof raw !== "string" || !raw.trim()) throw new Error("AI boş cevap verdi. Tekrar deneyin.");

  try {
    const parsed = JSON.parse(cleanJson(raw)) as Partial<PracticeReply>;
    if (!parsed.userTranslation?.trim() || !parsed.reply?.trim() || !parsed.replyTranslation?.trim()) throw new Error("missing fields");
    return {
      userTranslation: parsed.userTranslation.trim(),
      reply: parsed.reply.trim(),
      replyTranslation: parsed.replyTranslation.trim(),
    };
  } catch {
    throw new Error("AI cevabı okunamadı. Lütfen tekrar deneyin.");
  }
}
