import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function getSpeechErrorMessage(error: string) {
  if (error === "not-allowed") {
    return "Mikrofon izni verilmedi. Tarayıcı ayarlarından izin verin.";
  }
  if (error === "aborted") {
    return "Dinleme tarayıcı tarafından durduruldu. Aynı cihazda başka bir Dilmaç sekmesi dinliyorsa onu durdurup tekrar deneyin.";
  }
  return `Mikrofon hatası: ${error}`;
}

export function useSpeech(lang: string, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [activityTick, setActivityTick] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantsToListenRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const supported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Dil veya çeviri hedefi görüşme sırasında değişirse açık tanıma oturumu da
  // yeni ayarı kullanır; eski render'daki callback'e takılı kalmaz.
  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current.lang = lang;
  }, [lang]);

  const stop = useCallback(() => {
    wantsToListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => {
    const stopWhenLeaving = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", stopWhenLeaving);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenLeaving);
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [stop]);

  const toggle = useCallback(() => {
    if (recognitionRef.current && listening) {
      stop();
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Bu tarayıcı canlı konuşma tanımayı desteklemiyor. Chrome veya Edge deneyin.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript?.trim();
        if (event.results[index].isFinal && transcript) {
          setActivityTick((value) => value + 1);
          onFinalRef.current(transcript);
        }
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" && wantsToListenRef.current) return;
      if (event.error === "aborted" && !wantsToListenRef.current) return;
      setError(getSpeechErrorMessage(event.error));
      wantsToListenRef.current = false;
      setListening(false);
    };
    recognition.onend = () => {
      if (wantsToListenRef.current && document.visibilityState === "visible") {
        window.setTimeout(() => {
          if (!wantsToListenRef.current) return;
          try {
            recognition.start();
            setListening(true);
          } catch {
            wantsToListenRef.current = false;
            recognitionRef.current = null;
            setListening(false);
          }
        }, 250);
        return;
      }
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    wantsToListenRef.current = true;
    setError("");
    setListening(true);
    recognition.start();
  }, [lang, listening, stop]);

  return { supported, listening, error, toggle, stop, activityTick };
}

