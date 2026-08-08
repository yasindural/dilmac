import { logClientError } from "./errorLogger";

// Mobil tarayıcılar (iOS Safari/Chrome ve Android Chrome) konuşma sentezini
// yalnızca gerçek bir kullanıcı dokunuşuyla başlatılan ilk çağrıdan sonra
// çalar. AI cevabı gibi ağ isteği sonrası gelen otomatik seslendirmeler bu
// yüzden sessizce kayboluyordu. Bu modül, dokunuş anında sessiz bir cümle ile
// kilidi açar ve sonraki seslendirmeleri güvenilir biçimde oynatır.

let unlocked = false;
let cachedVoices: SpeechSynthesisVoice[] = [];
let voiceListenerBound = false;
let keepAliveTimer: number | null = null;

const isIOSWebKit = () =>
  typeof navigator !== "undefined"
  && /iP(?:hone|ad|od)/i.test(navigator.userAgent)
  && /AppleWebKit/i.test(navigator.userAgent);

function getSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  return window.speechSynthesis;
}

export function isSpeechOutputSupported() {
  return getSynthesis() !== null && typeof SpeechSynthesisUtterance !== "undefined";
}

function refreshVoices() {
  const synth = getSynthesis();
  if (!synth) return;
  const voices = synth.getVoices();
  if (voices.length) cachedVoices = voices;
  if (!voiceListenerBound && typeof synth.addEventListener === "function") {
    voiceListenerBound = true;
    synth.addEventListener("voiceschanged", refreshVoices);
  }
}

export function pickVoice(lang: string): SpeechSynthesisVoice | null {
  refreshVoices();
  if (!lang || !cachedVoices.length) return null;
  const wanted = lang.toLowerCase();
  const family = wanted.split("-")[0];
  return cachedVoices.find((voice) => voice.lang.toLowerCase() === wanted)
    || cachedVoices.find((voice) => voice.lang.toLowerCase().replace("_", "-") === wanted)
    || cachedVoices.find((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(`${family}-`))
    || null;
}

// Yalnızca gerçek kullanıcı dokunuşu işleyicilerinden çağrılmalı.
export function unlockSpeechOutput() {
  const synth = getSynthesis();
  if (!synth || unlocked || typeof SpeechSynthesisUtterance === "undefined") return;
  unlocked = true;
  try {
    refreshVoices();
    synth.resume();
    const primer = new SpeechSynthesisUtterance(" ");
    primer.volume = 0;
    primer.rate = 4;
    primer.onerror = () => { unlocked = false; };
    synth.speak(primer);
  } catch (error) {
    unlocked = false;
    logClientError("unlock_failed", "speech_output", error instanceof Error ? error.message : error, "warning");
  }
}

function stopKeepAlive() {
  if (keepAliveTimer !== null) window.clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

// iOS 15+ uzun cümleleri yaklaşık 15 saniye sonra sessizce keser;
// düzenli pause/resume bu kesilmeyi engelliyor.
function startKeepAlive() {
  if (!isIOSWebKit() || keepAliveTimer !== null) return;
  keepAliveTimer = window.setInterval(() => {
    const synth = getSynthesis();
    if (!synth || !synth.speaking) {
      stopKeepAlive();
      return;
    }
    synth.pause();
    synth.resume();
  }, 10000);
}

export function stopSpeechOutput() {
  stopKeepAlive();
  getSynthesis()?.cancel();
}

export type SpeechOutputHandlers = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
};

export function speakText(text: string, lang: string, handlers: SpeechOutputHandlers = {}): boolean {
  const synth = getSynthesis();
  if (!synth || typeof SpeechSynthesisUtterance === "undefined" || !text.trim()) {
    handlers.onError?.();
    return false;
  }
  refreshVoices();
  stopKeepAlive();
  synth.cancel();
  // Android Chrome'da cancel() hemen ardından gelen speak() çağrısı sesi
  // sessizce yutuyor; kısa bekleme bu yarışı engeller.
  window.setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    const finish = (failed: boolean) => {
      stopKeepAlive();
      if (failed) handlers.onError?.();
      else handlers.onEnd?.();
    };
    utterance.onstart = () => {
      startKeepAlive();
      handlers.onStart?.();
    };
    utterance.onend = () => finish(false);
    utterance.onerror = (event) => {
      // Yeni bir seslendirme eskisini iptal ettiğinde bu gerçek bir hata değildir.
      if (event.error !== "canceled" && event.error !== "interrupted") {
        logClientError(event.error || "unknown", "speech_output", `Seslendirme hatası: ${event.error}`);
        finish(true);
        return;
      }
      finish(false);
    };
    try {
      synth.speak(utterance);
    } catch (error) {
      logClientError("speak_failed", "speech_output", error instanceof Error ? error.message : error);
      finish(true);
    }
  }, 60);
  return true;
}
