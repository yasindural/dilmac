import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSpeechErrorMessage, shouldIgnoreTranscript } from "./useSpeech";
import { useSpeech } from "./useSpeech";

class MockRecognition {
  static latest: MockRecognition | null = null;
  lang = "";
  continuous = true;
  interimResults = false;
  onresult: ((event: { resultIndex?: number; results: ArrayLike<{ 0: { transcript: string; confidence?: number }; isFinal: boolean }> }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  stopped = false;
  constructor() { MockRecognition.latest = this; }
  start() {}
  stop() { this.stopped = true; }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.webkitSpeechRecognition;
  MockRecognition.latest = null;
});

describe("getSpeechErrorMessage", () => {
  it("explains microphone permission errors", () => {
    expect(getSpeechErrorMessage("not-allowed")).toContain("Mikrofon izni verilmedi");
  });

  it("explains same-device recognition interruptions", () => {
    expect(getSpeechErrorMessage("aborted")).toContain("başka bir TerraSpeak sekmesi");
  });

  it("keeps an actionable fallback for unknown errors", () => {
    expect(getSpeechErrorMessage("network")).toBe("Mikrofon hatası: network");
  });

  it("submits a stable interim sentence on iPhone even when WebKit never sends a final result", () => {
    vi.useFakeTimers();
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/140 Mobile");
    window.webkitSpeechRecognition = MockRecognition as never;
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeech("tr-TR", onFinal));

    act(() => result.current.toggle());
    expect(MockRecognition.latest?.continuous).toBe(false);
    act(() => {
      MockRecognition.latest?.onresult?.({ results: [{ 0: { transcript: "Sesimi duyuyor musun" }, isFinal: false }] });
      vi.advanceTimersByTime(1200);
    });

    expect(onFinal).toHaveBeenCalledWith("Sesimi duyuyor musun");
  });

  it("pauses iPhone recognition before an AI request when requested", () => {
    vi.useFakeTimers();
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/140 Mobile");
    window.webkitSpeechRecognition = MockRecognition as never;
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeech("tr-TR", onFinal, true));

    act(() => result.current.toggle());
    act(() => {
      MockRecognition.latest?.onresult?.({ results: [{ 0: { transcript: "Sesim geliyor mu" }, isFinal: false }] });
      vi.advanceTimersByTime(1200);
    });

    expect(MockRecognition.latest?.stopped).toBe(true);
    expect(result.current.listening).toBe(false);
    expect(onFinal).toHaveBeenCalledWith("Sesim geliyor mu");
  });

  it("mikrofon seslendirme için durdurulunca yarım kalan cümleyi teslim eder", () => {
    // Otomatik seslendirme mikrofonu duraklatır. Ekranda duran ön izleme
    // eskiden çöpe gidiyordu: kullanıcının son sözü sessizce kayboluyordu.
    window.webkitSpeechRecognition = MockRecognition as never;
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeech("tr-TR", onFinal));
    act(() => result.current.toggle());
    act(() => {
      MockRecognition.latest?.onresult?.({ results: [{ 0: { transcript: "yarım kalan cümle" }, isFinal: false }] });
    });
    act(() => result.current.stop());
    expect(onFinal).toHaveBeenCalledWith("yarım kalan cümle");
  });

  it("oturum final vermeden biterse ön izleme her platformda kurtarılır", () => {
    vi.useFakeTimers();
    window.webkitSpeechRecognition = MockRecognition as never;
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeech("tr-TR", onFinal));
    act(() => result.current.toggle());
    act(() => {
      MockRecognition.latest?.onresult?.({ results: [{ 0: { transcript: "android da kaybolmaz" }, isFinal: false }] });
      MockRecognition.latest?.onend?.();
    });
    expect(onFinal).toHaveBeenCalledWith("android da kaybolmaz");
  });
});

describe("shouldIgnoreTranscript", () => {
  const noRecent = { text: "", at: 0 };

  it("kısa ama gerçek cevapları düşürmez", () => {
    for (const word of ["ok", "no", "ja", "evet", "hı hı".replace(" ", "")]) {
      expect(shouldIgnoreTranscript(word, 0.9, noRecent)).toBe(false);
    }
  });

  it("uzatılmış dolgu seslerini eler", () => {
    for (const noise of ["ııı", "eee", "hmm", "uhh", "umm"]) {
      expect(shouldIgnoreTranscript(noise, 0.9, noRecent)).toBe(true);
    }
  });

  it("confidence bildirmeyen tarayıcıyı (0) cezalandırmaz", () => {
    // Android Chrome çoğu sonuçta confidence=0 döndürür; 0 "bilinmiyor"dur.
    expect(shouldIgnoreTranscript("bugün hava güzel", 0, noRecent)).toBe(false);
  });

  it("aynı finalin anında tekrarını eler ama gecikmiş tekrarı korur", () => {
    const now = 10_000;
    const recent = { text: "tamam", at: now - 300 };
    expect(shouldIgnoreTranscript("tamam", 0.9, recent, now)).toBe(true);
    expect(shouldIgnoreTranscript("tamam", 0.9, { text: "tamam", at: now - 1500 }, now)).toBe(false);
  });
});
