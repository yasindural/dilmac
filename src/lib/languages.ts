// Dilmaç'ın konuşma dilleri — tek gerçek kaynak.
//
// Üç ayrı isim alanı bilinçli olarak ayrıştırıldı:
//   code : Web Speech API'nin tanıma/seslendirme kodu (BCP-47)
//   name : Kullanıcıya gösterilen AD — dilin KENDİ adıyla (endonim).
//          Bir Japon "Japonca" kelimesini tanıyamaz ama 日本語'yu her yerde tanır.
//   api  : Çeviri modeline ve tel protokolüne giden İngilizce ad; modeller
//          "Translate into Romanian" komutunu her dilde adından daha iyi anlar.
export type AppLanguage = {
  code: string;
  name: string;
  api: string;
  flag: string;
};

export const conversationLanguages: AppLanguage[] = [
  { code: "tr-TR", name: "Türkçe", api: "Turkish", flag: "🇹🇷" },
  { code: "en-US", name: "English", api: "English", flag: "🇬🇧" },
  { code: "de-DE", name: "Deutsch", api: "German", flag: "🇩🇪" },
  { code: "fr-FR", name: "Français", api: "French", flag: "🇫🇷" },
  { code: "es-ES", name: "Español", api: "Spanish", flag: "🇪🇸" },
  { code: "it-IT", name: "Italiano", api: "Italian", flag: "🇮🇹" },
  { code: "pt-BR", name: "Português", api: "Portuguese", flag: "🇧🇷" },
  { code: "ru-RU", name: "Русский", api: "Russian", flag: "🇷🇺" },
  { code: "uk-UA", name: "Українська", api: "Ukrainian", flag: "🇺🇦" },
  { code: "ar-SA", name: "العربية", api: "Arabic", flag: "🇸🇦" },
  { code: "hi-IN", name: "हिन्दी", api: "Hindi", flag: "🇮🇳" },
  { code: "zh-CN", name: "中文", api: "Chinese", flag: "🇨🇳" },
  { code: "ja-JP", name: "日本語", api: "Japanese", flag: "🇯🇵" },
  { code: "ko-KR", name: "한국어", api: "Korean", flag: "🇰🇷" },
  { code: "id-ID", name: "Bahasa Indonesia", api: "Indonesian", flag: "🇮🇩" },
  { code: "nl-NL", name: "Nederlands", api: "Dutch", flag: "🇳🇱" },
  { code: "pl-PL", name: "Polski", api: "Polish", flag: "🇵🇱" },
  { code: "el-GR", name: "Ελληνικά", api: "Greek", flag: "🇬🇷" },
  { code: "sv-SE", name: "Svenska", api: "Swedish", flag: "🇸🇪" },
  { code: "ro-RO", name: "Română", api: "Romanian", flag: "🇷🇴" },
];

// Eski istemciler dil adını Türkçe gönderiyordu ("İngilizce"). Site herkes
// için aynı anda güncellense de açık kalmış eski bir sekmeyle görüşme
// kopmasın diye eski adlar da tanınır.
const legacyNames: Record<string, string> = {
  "Türkçe": "tr-TR", "İngilizce": "en-US", "Almanca": "de-DE", "Fransızca": "fr-FR",
  "İspanyolca": "es-ES", "İtalyanca": "it-IT", "Arapça": "ar-SA",
};

export function languageByCode(code: string): AppLanguage | undefined {
  return conversationLanguages.find((language) => language.code === code);
}

/** Endonim, İngilizce ad veya eski Türkçe ad — hangisi gelirse gelsin bulur. */
export function languageByName(name: string): AppLanguage | undefined {
  const trimmed = name.trim();
  return conversationLanguages.find((language) => language.name === trimmed || language.api === trimmed)
    || (legacyNames[trimmed] ? languageByCode(legacyNames[trimmed]) : undefined);
}

export function speechCodeFor(name: string): string {
  return languageByName(name)?.code || "tr-TR";
}

/** Tarayıcının diline en yakın konuşma dilini seçer (tam eşleşme > aile). */
export function detectConversationLanguage(): AppLanguage {
  const nav = (typeof navigator !== "undefined" ? navigator.language || "" : "").toLowerCase();
  const exact = conversationLanguages.find((language) => language.code.toLowerCase() === nav);
  if (exact) return exact;
  const family = nav.split("-")[0];
  const partial = conversationLanguages.find((language) => language.code.toLowerCase().startsWith(`${family}-`));
  return partial || conversationLanguages[0];
}

// Arama, aksan/büyük-küçük duyarsız: "turkce" → Türkçe, "greek" → Ελληνικά.
const fold = (value: string) => value.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "");

export function searchLanguages(query: string): AppLanguage[] {
  const needle = fold(query.trim());
  if (!needle) return conversationLanguages;
  return conversationLanguages.filter((language) =>
    fold(language.name).includes(needle)
    || fold(language.api).includes(needle)
    || fold(language.code).includes(needle)
    || Object.entries(legacyNames).some(([legacy, code]) => code === language.code && fold(legacy).includes(needle)));
}
