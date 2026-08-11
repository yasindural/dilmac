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

// iOS'un "novelty" (şaka) sesleri Web Speech API'sinde normal seslerle aynı
// listede görünür ve dil kodu tam eştiği için puanları yüksek çıkar. Telefonda
// çevirinin Flo/Rocko/Shelley gibi çizgi film sesiyle okunmasının sebebi buydu.
const noveltyVoices = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|eddy|flo|fred|good news|grandma|grandpa|hysterical|jester|junior|kathy|organ|princess|ralph|reed|rocko|sandy|shelley|superstar|trinoids|whisper|wobble|zarvox|bruce|pipe organ)\b/i;

// Platformların gerçek, doğal konuşan varsayılan sesleri.
const trustedVoices = /\b(samantha|alex|karen|daniel|moira|tessa|fiona|nicky|aaron|serena|martha|arthur|yelda|anna|thomas|monica|paulina|alice|milena|kyoko|o-ren|zosia|luciana|joana|ellen|xander|nora|sara|alva)\b/i;

// Aynı dilde birden fazla ses varsa en kalitelisini seç. Ağ tabanlı
// (Google gibi) sesler cihaz içi basit motorlardan daha doğal konuşur;
// "compact/espeak/pico" gibi motorlar ise telefonda metalik ve bozuk çıkar.
export function scoreVoice(voice: SpeechSynthesisVoice, wanted: string, family: string) {
  const voiceLang = voice.lang.toLowerCase().replace("_", "-");
  let score = 0;
  if (voiceLang === wanted) score += 100;
  else if (voiceLang.startsWith(`${family}-`) || voiceLang === family) score += 50;
  else return -1;
  // Şaka sesleri, yanlış aksanlı gerçek bir sesin bile altına düşsün.
  if (noveltyVoices.test(voice.name)) score -= 60;
  if (trustedVoices.test(voice.name)) score += 20;
  if (voice.localService === false) score += 12;
  if (/google|microsoft|siri/i.test(voice.name)) score += 8;
  if (/natural|neural|enhanced|premium|online|hd/i.test(voice.name)) score += 6;
  if (voice.default) score += 5;
  if (/compact|espeak|pico|basic/i.test(voice.name)) score -= 10;
  return score;
}

export function pickVoice(lang: string): SpeechSynthesisVoice | null {
  refreshVoices();
  if (!lang || !cachedVoices.length) return null;
  const wanted = lang.toLowerCase().replace("_", "-");
  const family = wanted.split("-")[0];
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;
  for (const voice of cachedVoices) {
    const score = scoreVoice(voice, wanted, family);
    // Negatif puan "bu dil hiç uymuyor" demek; yanlış dilde okumaktansa
    // tarayıcının kendi varsayılanına bırakmak daha doğru.
    if (score < 0) continue;
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

let voiceChoiceReported = false;

// Telefonda hangi sesin seçildiğini bir kez kayda yaz; kalite sorunlarını
// tahminle değil gerçek cihaz verisiyle çözebilmek için.
function reportVoiceChoice(lang: string, chosen: SpeechSynthesisVoice | null) {
  if (voiceChoiceReported) return;
  if (!/android|iP(?:hone|ad|od)/i.test(navigator.userAgent)) return;
  voiceChoiceReported = true;
  const family = lang.toLowerCase().replace("_", "-").split("-")[0];
  const matches = cachedVoices
    .filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(family))
    .slice(0, 4)
    .map((voice) => `${voice.lang}:${voice.name}${voice.localService === false ? "[net]" : ""}`)
    .join("; ");
  logClientError(
    "voice_choice",
    "speech_output",
    `dil=${lang} secilen=${chosen ? `${chosen.lang}:${chosen.name}` : "varsayilan"} eslesen=${matches || "yok"} toplam=${cachedVoices.length}`,
    "warning",
  );
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
    reportVoiceChoice(lang, voice);
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

// ---------------------------------------------------------------------------
// Seslendirme kuyruğu
// ---------------------------------------------------------------------------
// speakText her çağrıda önceki konuşmayı iptal eder; bu, kullanıcı bir balona
// dokunup "şunu tekrar oku" dediğinde doğru davranıştır. Ama karşı taraftan
// art arda iki cümle gelirse ikincisi birincisini yarıda keser. Otomatik
// seslendirme için cümleleri sıraya alıp tek tek okuyoruz.

type SpeechQueueItem = { text: string; lang: string; handlers: SpeechOutputHandlers };

const speechQueue: SpeechQueueItem[] = [];
let queueRunning = false;

function runSpeechQueue() {
  const item = speechQueue.shift();
  if (!item) {
    queueRunning = false;
    return;
  }
  queueRunning = true;
  const advance = (callback?: () => void) => {
    callback?.();
    // Cümleler arasında kısa bir nefes payı; art arda okunduğunda
    // tek bir uzun cümle gibi algılanmasını engelliyor.
    window.setTimeout(runSpeechQueue, 140);
  };
  const started = speakText(item.text, item.lang, {
    onStart: item.handlers.onStart,
    onEnd: () => advance(item.handlers.onEnd),
    onError: () => advance(item.handlers.onError),
  });
  if (!started) advance(item.handlers.onError);
}

/** Sıraya alır; önceki seslendirmeyi kesmez. */
export function queueSpeech(text: string, lang: string, handlers: SpeechOutputHandlers = {}) {
  if (!text.trim()) return false;
  speechQueue.push({ text, lang, handlers });
  if (!queueRunning) runSpeechQueue();
  return true;
}

/** Kuyrukta bekleyen ya da o an okunan bir cümle var mı? */
export function isSpeechQueueBusy() {
  return queueRunning || speechQueue.length > 0;
}

/** Kuyruğu boşaltır ve konuşmayı susturur. */
export function clearSpeechQueue() {
  speechQueue.length = 0;
  queueRunning = false;
  stopSpeechOutput();
}
