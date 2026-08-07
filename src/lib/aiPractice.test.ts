import { afterEach, describe, expect, it, vi } from "vitest";
import { practiceWithAi } from "./aiPractice";

afterEach(() => vi.restoreAllMocks());

describe("AI deneme konuşması", () => {
  it("AI JSON cevabını çeviri alanlarına ayırır", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ userTranslation: "Hello", reply: "How are you?", replyTranslation: "Nasılsın?" }) } }] }), { status: 200 }));
    const result = await practiceWithAi({ text: "Merhaba", userLanguage: "Türkçe", partnerLanguage: "İngilizce", history: [], key: "test" });
    expect(result).toEqual({ userTranslation: "Hello", reply: "How are you?", replyTranslation: "Nasılsın?" });
  });

  it("boş AI cevabını kullanıcı dostu hataya dönüştürür", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }));
    await expect(practiceWithAi({ text: "Merhaba", userLanguage: "Türkçe", partnerLanguage: "İngilizce", history: [], key: "test" })).rejects.toThrow("AI boş cevap verdi");
  });

  it("kredi biterse ücretsiz modele otomatik geçer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 402 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ userTranslation: "Hello", reply: "Welcome!", replyTranslation: "Hoş geldin!" }) } }] }), { status: 200 }));
    const result = await practiceWithAi({ text: "Merhaba", userLanguage: "Türkçe", partnerLanguage: "İngilizce", history: [], key: "test" });
    expect(result.reply).toBe("Welcome!");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).model).toBe("openrouter/free");
  });
});
