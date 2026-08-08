import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeUtterance = {
  text: string;
  lang: string;
  volume: number;
  rate: number;
  voice: unknown;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

const spoken: FakeUtterance[] = [];

const synth = {
  speaking: false,
  cancel: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  getVoices: vi.fn(() => [
    { lang: "tr-TR", name: "Türkçe Ses" },
    { lang: "en-US", name: "English Voice" },
  ]),
  speak: vi.fn((utterance: FakeUtterance) => {
    spoken.push(utterance);
  }),
  addEventListener: vi.fn(),
};

beforeEach(() => {
  spoken.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("speechSynthesis", synth);
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  vi.stubGlobal("SpeechSynthesisUtterance", class {
    text: string;
    lang = "";
    volume = 1;
    rate = 1;
    voice: unknown = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    constructor(text: string) { this.text = text; }
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("sesli çıktı", () => {
  it("dokunuş kilidini sessiz bir cümleyle açar", async () => {
    const { unlockSpeechOutput } = await import("./speechOutput");
    unlockSpeechOutput();
    expect(synth.resume).toHaveBeenCalledTimes(1);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(spoken[0].volume).toBe(0);
  });

  it("kilit bir kez açılır, tekrar dokunuşlar yeni cümle üretmez", async () => {
    const { unlockSpeechOutput } = await import("./speechOutput");
    unlockSpeechOutput();
    unlockSpeechOutput();
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("seslendirme önce eski konuşmayı iptal eder, kısa bekleyip yeni cümleyi doğru dilde okur", async () => {
    vi.useFakeTimers();
    const { speakText } = await import("./speechOutput");
    const onStart = vi.fn();
    const ok = speakText("Hello there", "en-US", { onStart });
    expect(ok).toBe(true);
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(synth.speak).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(spoken[0].text).toBe("Hello there");
    expect(spoken[0].lang).toBe("en-US");
    expect(spoken[0].voice).toMatchObject({ lang: "en-US" });
    spoken[0].onstart?.();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("iptal kaynaklı hataları gerçek hata gibi bildirmez", async () => {
    vi.useFakeTimers();
    const { speakText } = await import("./speechOutput");
    const onError = vi.fn();
    const onEnd = vi.fn();
    speakText("Merhaba", "tr-TR", { onError, onEnd });
    await vi.advanceTimersByTimeAsync(100);
    spoken[0].onerror?.({ error: "interrupted" });
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("aynı dilde ağ tabanlı kaliteli sesi cihaz içi basit sese tercih eder", async () => {
    synth.getVoices.mockReturnValue([
      { lang: "en-US", name: "English (US) compact", localService: true },
      { lang: "en-US", name: "Google US English", localService: false },
      { lang: "tr-TR", name: "Türkçe Ses", localService: true },
    ] as never);
    const { pickVoice } = await import("./speechOutput");
    const chosen = pickVoice("en-US");
    expect(chosen).toMatchObject({ name: "Google US English" });
  });

  it("tam eşleşme yoksa aynı dil ailesinden en iyi sesi seçer", async () => {
    synth.getVoices.mockReturnValue([
      { lang: "en-GB", name: "Google UK English Female", localService: false },
      { lang: "tr-TR", name: "Türkçe Ses", localService: true },
    ] as never);
    const { pickVoice } = await import("./speechOutput");
    const chosen = pickVoice("en-US");
    expect(chosen).toMatchObject({ lang: "en-GB" });
  });

  it("tarayıcı desteklemiyorsa hata bildirir ve çökmez", async () => {
    Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true });
    const { speakText, unlockSpeechOutput } = await import("./speechOutput");
    const onError = vi.fn();
    expect(speakText("Merhaba", "tr-TR", { onError })).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(() => unlockSpeechOutput()).not.toThrow();
  });
});
