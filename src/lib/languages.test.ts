import { describe, expect, it } from "vitest";
import { conversationLanguages, languageByName, searchLanguages, speechCodeFor } from "./languages";

describe("konuşma dilleri", () => {
  it("tam 20 dil vardır ve kodlar benzersizdir", () => {
    expect(conversationLanguages).toHaveLength(20);
    expect(new Set(conversationLanguages.map((l) => l.code)).size).toBe(20);
  });

  it("endonim, İngilizce ad ve eski Türkçe adla bulunur", () => {
    expect(languageByName("Türkçe")?.code).toBe("tr-TR");
    expect(languageByName("Turkish")?.code).toBe("tr-TR");
    expect(languageByName("İngilizce")?.code).toBe("en-US"); // eski istemci uyumu
    expect(languageByName("日本語")?.code).toBe("ja-JP");
  });

  it("seslendirme kodu bilinmeyen ad için Türkçeye düşer", () => {
    expect(speechCodeFor("Klingonca")).toBe("tr-TR");
    expect(speechCodeFor("German")).toBe("de-DE");
  });

  it("arama aksan ve büyük-küçük duyarsızdır", () => {
    expect(searchLanguages("turkce").some((l) => l.code === "tr-TR")).toBe(true);
    expect(searchLanguages("GREEK").some((l) => l.code === "el-GR")).toBe(true);
    expect(searchLanguages("almanca").some((l) => l.code === "de-DE")).toBe(true); // eski ad
    expect(searchLanguages("")).toHaveLength(20);
  });
});
