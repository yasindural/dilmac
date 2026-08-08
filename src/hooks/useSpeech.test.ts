import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSpeechErrorMessage } from "./useSpeech";
import { useSpeech } from "./useSpeech";

let recognitionInstance: MockRecognition | null = null;

class MockRecognition {
  lang = "";
  continuous = true;
  interimResults = false;
  onresult: ((event: { resultIndex?: number; results: ArrayLike<{ 0: { transcript: string; confidence?: number }; isFinal: boolean }> }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() { recognitionInstance = this; }
  start() {}
  stop() {}
}

afterEach(() => {
  vi.restoreAllMocks();
  delete window.webkitSpeechRecognition;
  recognitionInstance = null;
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

  it("submits the last interim sentence when iPhone WebKit ends without a final result", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/140 Mobile");
    window.webkitSpeechRecognition = MockRecognition as never;
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeech("tr-TR", onFinal));

    act(() => result.current.toggle());
    expect(recognitionInstance?.continuous).toBe(false);
    act(() => {
      recognitionInstance?.onresult?.({ results: [{ 0: { transcript: "Sesimi duyuyor musun" }, isFinal: false }] });
      recognitionInstance?.onend?.();
    });

    expect(onFinal).toHaveBeenCalledWith("Sesimi duyuyor musun");
  });
});
