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



const starters = ["Merhaba, bugün nasılsın?", "Bana kendinden biraz bahseder misin?", "Yarın için bir plan yapalım."];

export default function AiPractice({ onConversingChange }: { onConversingChange?: (value: boolean) => void } = {}) {
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
      setError(requestError instanceof Error ? requestError.message : "AI cevabı alınamadı.");
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
      speakText("Mikrofon açık. Konuşmaya devam edebilirsiniz.", userLanguage, {
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
    <section className="room practice-room" aria-label="AI ile pratik">
      <header className="room-bar">
        <div className="chip room-chip ai-chip">
          <Bot />
          <b>AI PRATİK</b>
        </div>
        <div className="chip peer-chip on">
          <i aria-hidden="true" />
          <span>{busy ? "AI yazıyor…" : "AI hazır · anında yanıtlar"}</span>
        </div>
        <div className="room-bar-actions">
          <button
            type="button"
            className={`icon ${autoSpeak ? "on" : ""}`}
            onClick={() => setAutoSpeak((value) => !value)}
            aria-pressed={autoSpeak}
            title={autoSpeak ? "AI cevabı sesli okunuyor" : "AI cevabı sessiz"}
          >
            {autoSpeak ? <Volume2 /> : <VolumeX />}
            <small>Oto ses</small>
          </button>
          {turns.length > 0 && (
            <button
              type="button"
              className="icon"
              onClick={() => { setTurns([]); turnsRef.current = []; speechQueueRef.current = []; setError(""); }}
              title="Konuşmayı sıfırla"
            >
              <RotateCcw />
              <small>Sıfırla</small>
            </button>
          )}
        </div>
      </header>

      <div className="langbar">
        <LanguagePicker
          value={userLanguage}
          onChange={(code) => { setUserLanguage(code); setTurns([]); turnsRef.current = []; speechQueueRef.current = []; }}
          label="SİZ"
        />
        <button className="langbar-swap swap-button" type="button" onClick={swapLanguages} aria-label="Dilleri değiştir"><ArrowLeftRight /></button>
        <LanguagePicker
          value={aiLanguage}
          onChange={(code) => { setAiLanguage(code); setTurns([]); turnsRef.current = []; speechQueueRef.current = []; }}
          label="AI"
          align="end"
        />
      </div>

      <div className="room-feed" ref={feedRef} aria-live="polite">
        {!turns.length && !busy && !speech.interimText && (
          <div className="room-empty">
            <Bot />
            <h2>İlk cümlenizi söyleyin</h2>
            <p>Mikrofona basıp kendi dilinizde konuşun. AI, {aiLanguageName} cevap verir ve çevirisini altına yazar.</p>
            <div className="practice-starters">
              {starters.map((starter) => (
                <button key={starter} type="button" onClick={() => { unlockSpeechOutput(); void send(starter); }}>{starter}</button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, index) => (
          <div className="practice-pair" key={`${turn.userText}-${index}`}>
            <article className="turn mine first-of-group">
              <span className="turn-who">Siz</span>
              <p className="turn-main">{turn.userText}</p>
              <p className="turn-sub">{turn.userTranslation}</p>
            </article>
            <article className="turn theirs first-of-group" onClick={() => { unlockSpeechOutput(); speak(turn.reply); }}>
              <span className="turn-who">AI · {aiLanguageName}</span>
              <p className="turn-main">{turn.reply}</p>
              <p className="turn-sub">{turn.replyTranslation}</p>
              <span className="turn-meta">Dokun, tekrar dinle</span>
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
        {error || speech.error || (speech.listening ? "Dinliyorum… konuşun" : busy ? "AI düşünüyor…" : "Mikrofona basıp konuşmaya başlayın")}
      </p>

      <div className="room-controls">
        <button type="button" className="round" onClick={() => setShowKeyboard((value) => !value)} title="Klavyeyle yaz">
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
          <span>{speech.listening ? "Durdur" : "Konuş"}</span>
        </button>
        <button
          type="button"
          className={`round ${autoSpeak ? "on" : ""}`}
          onClick={() => setAutoSpeak((value) => !value)}
          title={autoSpeak ? "AI sesini kapat" : "AI sesini aç"}
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
            placeholder={`${userLanguageName} yazın…`}
            aria-label="AI ile konuşulacak mesaj"
          />
          <button className="round send" type="submit" disabled={!draft.trim()}><ArrowUp /></button>
        </form>
      )}
    </section>
  );
}