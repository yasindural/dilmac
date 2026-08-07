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
  if (!key) {
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
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": location.origin,
      "X-Title": "Dilmaç AI Deneme",
    },
    body: JSON.stringify({
      model: import.meta.env.VITE_OPENROUTER_MODEL || "openai/gpt-4o-mini",
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a friendly, concise conversation partner for testing live translation. The human speaks ${userLanguage}; you speak ${partnerLanguage}. Return only valid JSON with exactly these string keys: userTranslation (the human's latest message translated naturally into ${partnerLanguage}), reply (your short natural response in ${partnerLanguage}), replyTranslation (your reply translated naturally into ${userLanguage}). Keep the reply to one or two sentences. Never add markdown.`,
        },
        {
          role: "user",
          content: JSON.stringify({ previousConversation: recentContext, latestMessage: text }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(response.status === 402
      ? "OpenRouter bakiyesi yetersiz. Bakiye ekledikten sonra tekrar deneyin."
      : "AI deneme servisine ulaşılamadı. Birkaç saniye sonra tekrar deneyin.");
  }

  const payload = await response.json();
  const raw = payload.choices?.[0]?.message?.content;
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
