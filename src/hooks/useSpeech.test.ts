import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSpeechErrorMessage } from "./useSpeech";
import { useSpeech } from "./useSpeech";

class MockRecognition {
  static latest: MockRecognition | null = null;
  lang = "";
  continuous = true;
  interimResults = false;
  onresult: ((event: { resultIndex?: number; results: ArrayLike<{ 0: { transcript: string; confidence?: number }; isFinal: boolean }> }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() { MockRecognition.latest = this; }
  start() {}
  stop() {}
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
    expect(getSpeechErrorMessage("aborted")).toContain("başka bir Dilmaç sekmesi");
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
});
