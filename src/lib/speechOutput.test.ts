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
    expect(synth.cancel).toHaveBeenCalled();
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

  it("iOS'un saka seslerini (Flo, Rocko) eler, gercek sesi secer", async () => {
    synth.getVoices.mockReturnValue([
      { lang: "en-US", name: "Flo", localService: true },
      { lang: "en-GB", name: "Rocko", localService: true },
      { lang: "en-US", name: "Samantha", localService: true },
      { lang: "tr-TR", name: "Yelda", localService: true },
    ] as never);
    const { pickVoice } = await import("./speechOutput");
    expect(pickVoice("en-US")).toMatchObject({ name: "Samantha" });
    expect(pickVoice("tr-TR")).toMatchObject({ name: "Yelda" });
  });

  it("kuyruk cumleleri sirayla okur, birbirini kesmez", async () => {
    vi.useFakeTimers();
    const { queueSpeech, isSpeechQueueBusy } = await import("./speechOutput");
    queueSpeech("Birinci cumle", "tr-TR");
    queueSpeech("Ikinci cumle", "tr-TR");
    await vi.advanceTimersByTimeAsync(100);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(spoken[0].text).toBe("Birinci cumle");
    expect(isSpeechQueueBusy()).toBe(true);
    spoken[0].onend?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(spoken[1].text).toBe("Ikinci cumle");
    spoken[1].onend?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(isSpeechQueueBusy()).toBe(false);
  });

  it("kuyruk temizlenince bekleyen zamanlayici hayalet ses calamaz", async () => {
    vi.useFakeTimers();
    const { queueSpeech, clearSpeechQueue } = await import("./speechOutput");
    queueSpeech("Hayalet olacak cumle", "tr-TR");
    // konusma 60ms gecikmeli baslar; gecikme dolmadan temizle
    await vi.advanceTimersByTimeAsync(20);
    clearSpeechQueue();
    await vi.advanceTimersByTimeAsync(500);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("'tekrar oku' kuyrugu keser, tek ses kalir ve kuyruk kaosa girmez", async () => {
    vi.useFakeTimers();
    const { queueSpeech, speakText, isSpeechQueueBusy } = await import("./speechOutput");
    queueSpeech("Otomatik birinci", "tr-TR");
    queueSpeech("Otomatik ikinci", "tr-TR");
    await vi.advanceTimersByTimeAsync(100);
    expect(spoken[0].text).toBe("Otomatik birinci");
    // kullanici balona dokundu: aktif ses kesilir, dokunulan metin okunur
    speakText("Dokunulan cumle", "tr-TR");
    spoken[0].onerror?.({ error: "interrupted" });
    await vi.advanceTimersByTimeAsync(200);
    const texts = spoken.map((utterance) => utterance.text);
    expect(texts).toContain("Dokunulan cumle");
    // kesilen otomatik cumlenin "bitti" olayi kuyrugu ikinci kez calistiramaz
    expect(texts).not.toContain("Otomatik ikinci");
    spoken[spoken.length - 1].onend?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(isSpeechQueueBusy()).toBe(false);
  });

  it("kuyruk bosalinca idle abonelerine bir kez haber verir", async () => {
    vi.useFakeTimers();
    const { queueSpeech, onSpeechQueueIdle } = await import("./speechOutput");
    const onIdle = vi.fn();
    onSpeechQueueIdle(onIdle);
    queueSpeech("Tek cumle", "tr-TR");
    await vi.advanceTimersByTimeAsync(100);
    expect(onIdle).not.toHaveBeenCalled();
    spoken[0].onend?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("temizleme de idle bildirir (mikrofon devri kilitlenmez)", async () => {
    vi.useFakeTimers();
    const { queueSpeech, clearSpeechQueue, onSpeechQueueIdle } = await import("./speechOutput");
    const onIdle = vi.fn();
    onSpeechQueueIdle(onIdle);
    queueSpeech("Yarim kalacak", "tr-TR");
    await vi.advanceTimersByTimeAsync(100);
    clearSpeechQueue();
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});
