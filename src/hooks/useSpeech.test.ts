import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSpeechErrorMessage, shouldIgnoreTranscript, useSpeech } from "./useSpeech";

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
});

describe("konuşma filtresi", () => {
  it("kısa ama anlamlı cevapları atmaz", () => {
    const previous = { text: "", at: 0 };
    expect(shouldIgnoreTranscript("no", 0.91, previous, 10_000)).toBe(false);
    expect(shouldIgnoreTranscript("ja", 0.91, previous, 10_000)).toBe(false);
    expect(shouldIgnoreTranscript("ok", 0.91, previous, 10_000)).toBe(false);
    expect(shouldIgnoreTranscript("i", 0.91, previous, 10_000)).toBe(false);
  });

  it("uzatılmış dolgu seslerini süzer", () => {
    const previous = { text: "", at: 0 };
    expect(shouldIgnoreTranscript("ııı", 0.9, previous, 10_000)).toBe(true);
    expect(shouldIgnoreTranscript("mmm", 0.9, previous, 10_000)).toBe(true);
  });

  it("aynı gerçek cevabın bir saniyeden sonra tekrar söylenmesine izin verir", () => {
    const previous = { text: "hayır", at: 10_000 };
    expect(shouldIgnoreTranscript("hayır", 0.9, previous, 10_500)).toBe(true);
    expect(shouldIgnoreTranscript("hayır", 0.9, previous, 11_050)).toBe(false);
  });
});

describe("useSpeech", () => {
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
});
