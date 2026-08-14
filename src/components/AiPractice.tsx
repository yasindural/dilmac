import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ArrowUp, Bot, Keyboard, Mic, MicOff, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useSpeech } from "../hooks/useSpeech";
import { practiceWithAi, type PracticeHistoryTurn } from "../lib/aiPractice";
import { speakText, unlockSpeechOutput } from "../lib/speechOutput";
import { logClientError } from "../lib/errorLogger";
import "../room.css";
import "../ai-practice.css";
import LanguagePicker from "./LanguagePicker";
import { detectConversationLanguage, languageByCode } from "../lib/languages";
import { useI18n } from "../lib/i18n";





export default function AiPractice({ onConversingChange }: { onConversingChange?: (value: boolean) => void } = {}) {
  const { t } = useI18n();
  // send/uyarı geri çağrıları sabit kimlikte kalmalı (mikrofon oturumunu
  // yeniden başlatmamak için); çeviriciyi ref'ten okuyoruz.
  const tRef = useRef(t);
  tRef.current = t;
  const [userLanguage, setUserLanguage] = useState(() => detectConversationLanguage().code);
  const [aiLanguage, setAiLanguage] = useState(() => detectConversationLanguage().code.startsWith("en") ? "tr-TR" : "en-US");
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<PracticeHistoryTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const aiSpeakingRef = useRef(false);
  const ignoreSpeechUntilRef = useRef(0);
  const turnsRef = useRef<PracticeHistoryTurn[]>([]);
  const speechQueueRef = useRef<string[]>([]);
  const processingSpeechRef = useRef(false);
  const restartMobileSpeechRef = useRef(false);
  const speechToggleRef = useRef<() => void>(() => undefined);

  const userLanguageName = useMemo(() => languageByCode(userLanguage)?.name || userLanguage, [userLanguage]);
  const aiLanguageName = useMemo(() => languageByCode(aiLanguage)?.name || aiLanguage, [aiLanguage]);
  const userLanguageApi = useMemo(() => languageByCode(userLanguage)?.api || userLanguage, [userLanguage]);
  const aiLanguageApi = useMemo(() => languageByCode(aiLanguage)?.api || aiLanguage, [aiLanguage]);

  const speak = useCallback((text: string) => {
    speakText(text, aiLanguage, {
      onStart: () => { aiSpeakingRef.current = true; ignoreSpeechUntilRef.current = Number.POSITIVE_INFINITY; },
      onEnd: () => { aiSpeakingRef.current = false; ignoreSpeechUntilRef.current = Date.now() + 1800; },
      onError: () => { aiSpeakingRef.current = false; ignoreSpeechUntilRef.current = Date.now() + 800; },
    });
  }, [aiLanguage]);

  const runTurn = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;
    setBusy(true);
    setError("");
    setDraft("");
    try {
      const result = await practiceWithAi({
        text,
        userLanguage: userLanguageApi,
        partnerLanguage: aiLanguageApi,
        history: turnsRef.current,
      });
      setTurns((current) => {
        const next = [...current, { userText: text, ...result }];
        turnsRef.current = next;
        return next;
      });
      if (autoSpeak) speak(result.reply);
    } catch (requestError) {
      logClientError("turn_failed", "practice_ui", requestError instanceof Error ? requestError.message : requestError);
      setError(tRef.current("ai.error"));
    } finally {
      setBusy(false);
      if (restartMobileSpeechRef.current) {
        restartMobileSpeechRef.current = false;
        window.setTimeout(() => speechToggleRef.current(), 500);
      }
    }
  }, [aiLanguageApi, autoSpeak, speak, userLanguageApi]);

  const enqueueSpeech = useCallback((rawText: string) => {
    const sentences = rawText.match(/[^.!?…。！？]+[.!?…。！？]?/g)?.map((part) => part.trim()).filter(Boolean) || [];
    speechQueueRef.current.push(...sentences);
    if (processingSpeechRef.current) return;
    processingSpeechRef.current = true;
    void (async () => {
      try {
        while (speechQueueRef.current.length) {
          const nextSentence = speechQueueRef.current.shift();
          if (nextSentence) await runTurn(nextSentence);
        }
      } finally {
        processingSpeechRef.current = false;
      }
    })();
  }, [runTurn]);

  const send = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;
    enqueueSpeech(text);
  }, [enqueueSpeech]);

  const speech = useSpeech(userLanguage, (text) => {
    if (!aiSpeakingRef.current && Date.now() > ignoreSpeechUntilRef.current) {
      restartMobileSpeechRef.current = /iP(?:hone|ad|od)/i.test(navigator.userAgent) && /AppleWebKit/i.test(navigator.userAgent);
      enqueueSpeech(text);
    }
  }, true);
  speechToggleRef.current = speech.toggle;
  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior: turns.length > 1 ? "smooth" : "auto" });
  }, [busy, turns]);

  // Deneme sayacı ancak gerçekten konuşulurken işlesin: mikrofon açıkken,
  // AI yanıt üretirken veya en az bir tur konuşulmuşken.
  const conversing = speech.listening || busy || turns.length > 0;
  useEffect(() => {
    document.body.classList.add("room-locked");
    return () => document.body.classList.remove("room-locked");
  }, []);
  useEffect(() => { onConversingChange?.(conversing); }, [conversing, onConversingChange]);
  useEffect(() => () => onConversingChange?.(false), [onConversingChange]);
  useEffect(() => {
    if (!speech.listening) return;
    const warning = window.setTimeout(() => {
      speakText(tRef.current("ai.micOpen"), userLanguage, {
        onStart: () => { aiSpeakingRef.current = true; ignoreSpeechUntilRef.current = Number.POSITIVE_INFINITY; },
        onEnd: () => { aiSpeakingRef.current = false; ignoreSpeechUntilRef.current = Date.now() + 1800; },
        onError: () => { aiSpeakingRef.current = false; ignoreSpeechUntilRef.current = Date.now() + 800; },
      });
    }, 60000);
    return () => window.clearTimeout(warning);
  }, [speech.activityTick, speech.listening, userLanguage]);
  const submit = (event: FormEvent) => { event.preventDefault(); unlockSpeechOutput(); void send(draft); };
  const swapLanguages = () => {
    setUserLanguage(aiLanguage);
    setAiLanguage(userLanguage);
    setTurns([]);
    turnsRef.current = [];
    speechQueueRef.current = [];
    setError("");
  };

  return (
    <section className="room practice-room" aria-label={t("ai.aria")}>
      <header className="room-bar">
        <div className="chip room-chip ai-chip">
          <Bot />
          <b>{t("ai.badge")}</b>
        </div>
        <div className="chip peer-chip on">
          <i aria-hidden="true" />
          <span>{busy ? t("ai.typing") : t("ai.ready")}</span>
        </div>
        <div className="room-bar-actions">
          <button
            type="button"
            className={`icon ${autoSpeak ? "on" : ""}`}
            onClick={() => setAutoSpeak((value) => !value)}
            aria-pressed={autoSpeak}
            title={autoSpeak ? t("ai.voiceOn") : t("ai.voiceOff")}
          >
            {autoSpeak ? <Volume2 /> : <VolumeX />}
            <small>{t("room.autoLabel")}</small>
          </button>
          {turns.length > 0 && (
            <button
              type="button"
              className="icon"
              onClick={() => { setTurns([]); turnsRef.current = []; speechQueueRef.current = []; setError(""); }}
              title={t("ai.resetAria")}
            >
              <RotateCcw />
              <small>{t("ai.reset")}</small>
            </button>
          )}
        </div>
      </header>

      <div className="langbar">
        <LanguagePicker
          value={userLanguage}
          onChange={(code) => { setUserLanguage(code); setTurns([]); turnsRef.current = []; speechQueueRef.current = []; }}
          label={t("room.you")}
        />
        <button className="langbar-swap swap-button" type="button" onClick={swapLanguages} aria-label={t("ai.swap")}><ArrowLeftRight /></button>
        <LanguagePicker
          value={aiLanguage}
          onChange={(code) => { setAiLanguage(code); setTurns([]); turnsRef.current = []; speechQueueRef.current = []; }}
          label={t("ai.aiSide")}
          align="end"
        />
      </div>

      <div className="room-feed" ref={feedRef} aria-live="polite">
        {!turns.length && !busy && !speech.interimText && (
          <div className="room-empty">
            <Bot />
            <h2>{t("ai.emptyTitle")}</h2>
            <p>{t("ai.emptyText", { language: aiLanguageName })}</p>
            <div className="practice-starters">
              {[t("ai.starter1"), t("ai.starter2"), t("ai.starter3")].map((starter) => (
                <button key={starter} type="button" onClick={() => { unlockSpeechOutput(); void send(starter); }}>{starter}</button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, index) => (
          <div className="practice-pair" key={`${turn.userText}-${index}`}>
            <article className="turn mine first-of-group">
              <span className="turn-who">{t("room.mine")}</span>
              <p className="turn-main">{turn.userText}</p>
              <p className="turn-sub">{turn.userTranslation}</p>
            </article>
            <article className="turn theirs first-of-group" onClick={() => { unlockSpeechOutput(); speak(turn.reply); }}>
              <span className="turn-who">{t("ai.aiSide")} · {aiLanguageName}</span>
              <p className="turn-main">{turn.reply}</p>
              <p className="turn-sub">{turn.replyTranslation}</p>
              <span className="turn-meta">{t("ai.replayHint")}</span>
            </article>
          </div>
        ))}

        {speech.interimText && (
          <article className="turn mine ghost" aria-live="polite">
            <p className="turn-main">{speech.interimText}<i className="caret" /></p>
          </article>
        )}

        {busy && (
          <article className="turn theirs ghost typing">
            <span className="typing-dots"><span /><span /><span /></span>
          </article>
        )}
      </div>

      <p className={`room-status ${error || speech.error ? "error" : ""}`} role="status" aria-live="polite">
        {error || (speech.error ? t("error.mic") : "") || (speech.listening ? t("ai.listening") : busy ? t("ai.thinking") : t("ai.startHint"))}
      </p>

      <div className="room-controls">
        <button type="button" className="round" onClick={() => setShowKeyboard((value) => !value)} title={t("room.keyboard")}>
          <Keyboard />
        </button>
        <button
          type="button"
          className={`mic-button ${speech.listening ? "live" : ""}`}
          onClick={() => { unlockSpeechOutput(); speech.toggle(); }}
          disabled={!speech.supported}
          aria-pressed={speech.listening}
        >
          {speech.listening ? <MicOff /> : <Mic />}
          <span>{speech.listening ? t("room.stop") : t("room.speak")}</span>
        </button>
        <button
          type="button"
          className={`round ${autoSpeak ? "on" : ""}`}
          onClick={() => setAutoSpeak((value) => !value)}
          title={autoSpeak ? t("ai.voiceOffAria") : t("ai.voiceAria")}
        >
          {autoSpeak ? <Volume2 /> : <VolumeX />}
        </button>
      </div>

      {showKeyboard && (
        <form className="room-composer" onSubmit={(event) => { submit(event); setShowKeyboard(false); }}>
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("ai.composePh", { language: userLanguageName })}
            aria-label={t("ai.composeAria")}
          />
          <button className="round send" type="submit" disabled={!draft.trim()}><ArrowUp /></button>
        </form>
      )}
    </section>
  );
}
