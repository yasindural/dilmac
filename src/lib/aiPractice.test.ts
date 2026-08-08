import { afterEach, describe, expect, it, vi } from "vitest";
import { practiceWithAi } from "./aiPractice";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("AI deneme konuşması", () => {
  it("AI JSON cevabını çeviri alanlarına ayırır", async () => {
    vi.stubEnv("VITE_DILMAC_API_URL", "https://api.example.test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ content: JSON.stringify({ userTranslation: "Hello", reply: "How are you?", replyTranslation: "Nasılsın?" }) }), { status: 200 }));
    const result = await practiceWithAi({ text: "Merhaba", userLanguage: "Türkçe", partnerLanguage: "İngilizce", history: [], key: "test" });
    expect(result).toEqual({ userTranslation: "Hello", reply: "How are you?", replyTranslation: "Nasılsın?" });
  });

  it("boş AI cevabını kullanıcı dostu hataya dönüştürür", async () => {
    vi.stubEnv("VITE_DILMAC_API_URL", "https://api.example.test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ content: "" }), { status: 200 }));
    await expect(practiceWithAi({ text: "Merhaba", userLanguage: "Türkçe", partnerLanguage: "İngilizce", history: [], key: "test" })).rejects.toThrow("AI boş cevap verdi");
  });

  it("backend kredi hatasını kullanıcı dostu mesaja dönüştürür", async () => {
    vi.stubEnv("VITE_DILMAC_API_URL", "https://api.example.test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 402 }));
    await expect(practiceWithAi({ text: "Merhaba", userLanguage: "Türkçe", partnerLanguage: "İngilizce", history: [], key: "test" })).rejects.toThrow("kullanım sınırı dolu");
  });
});
