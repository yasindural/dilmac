import { FormEvent, useCallback, useMemo, useState } from "react";
import { ArrowRight, Bot, CheckCircle2, Languages, Mic, MicOff, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { useSpeech } from "../hooks/useSpeech";
import { bundledOpenRouterKey } from "../lib/runtimeConfig";
import { practiceWithAi, type PracticeHistoryTurn } from "../lib/aiPractice";
import "../ai-practice.css";

const practiceLanguages = [
  ["tr-TR", "Türkçe"], ["en-US", "İngilizce"], ["de-DE", "Almanca"],
  ["fr-FR", "Fransızca"], ["es-ES", "İspanyolca"], ["it-IT", "İtalyanca"], ["ar-SA", "Arapça"],
];

const starters = ["Merhaba, bugün nasılsın?", "Bana kendinden biraz bahseder misin?", "Yarın için bir plan yapalım."];

export default function AiPractice() {
  const [userLanguage, setUserLanguage] = useState("tr-TR");
  const [aiLanguage, setAiLanguage] = useState("en-US");
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<PracticeHistoryTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);

  const languageName = useCallback((code: string) => practiceLanguages.find(([value]) => value === code)?.[1] || code, []);
  const userLanguageName = useMemo(() => languageName(userLanguage), [languageName, userLanguage]);
  const aiLanguageName = useMemo(() => languageName(aiLanguage), [aiLanguage, languageName]);

  const speak = useCallback((text: string) => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = aiLanguage;
    speechSynthesis.speak(utterance);
  }, [aiLanguage]);

  const send = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setDraft("");
    try {
      const result = await practiceWithAi({
        text,
        userLanguage: userLanguageName,
        partnerLanguage: aiLanguageName,
        history: turns,
        key: bundledOpenRouterKey,
      });
      setTurns((current) => [...current, { userText: text, ...result }]);
      if (autoSpeak) speak(result.reply);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI cevabı alınamadı.");
    } finally {
      setBusy(false);
    }
  }, [aiLanguageName, autoSpeak, busy, speak, turns, userLanguageName]);

  const speech = useSpeech(userLanguage, (text) => void send(text));
  const submit = (event: FormEvent) => { event.preventDefault(); void send(draft); };
  const swapLanguages = () => {
    setUserLanguage(aiLanguage);
    setAiLanguage(userLanguage);
    setTurns([]);
    setError("");
  };

  return (
    <section className="practice-page">
      <div className="practice-hero">
        <div className="practice-kicker"><Sparkles /> KİMSEYİ BEKLEMEDEN TEST EDİN</div>
        <h1>AI ile konuşun,<br /><em>çeviriyi anlayın.</em></h1>
        <p>Siz kendi dilinizde konuşun. Dilmaç cümlenizi çevirsin, AI seçtiğiniz dilde yanıtlasın ve cevabın Türkçesini de yanına koysun.</p>
        <div className="practice-badges"><span><CheckCircle2 /> Gerçek OpenRouter çevirisi</span><span><CheckCircle2 /> Sesli yanıt</span><span><CheckCircle2 /> Tek kişilik test</span></div>
      </div>

      <div className="practice-shell">
        <div className="practice-topbar">
          <label>Sizin diliniz<select value={userLanguage} onChange={(event) => { setUserLanguage(event.target.value); setTurns([]); }}>{practiceLanguages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <button className="practice-swap" onClick={swapLanguages} aria-label="Dilleri değiştir"><Languages /></button>
          <label>AI'ın dili<select value={aiLanguage} onChange={(event) => { setAiLanguage(event.target.value); setTurns([]); }}>{practiceLanguages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <label className="voice-toggle"><input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} /><span>AI cevabını seslendir</span></label>
        </div>

        <div className="practice-status"><i className={busy ? "thinking" : ""} /><span>{busy ? "AI düşünüyor ve çeviriyor…" : `Hazır · ${userLanguageName} → ${aiLanguageName}`}</span></div>

        <div className="practice-feed" aria-live="polite">
          {!turns.length && !busy && <div className="practice-empty"><div><Bot /></div><h2>İlk cümlenizi söyleyin</h2><p>Örneklerden birini seçin veya aşağıdaki mikrofona dokunun.</p><div className="practice-starters">{starters.map((text) => <button key={text} onClick={() => void send(text)}>{text}<ArrowRight /></button>)}</div></div>}
          {turns.map((turn, index) => <div className="practice-turn" key={`${turn.userText}-${index}`}>
            <article className="practice-message mine"><header><span>Siz</span><small>{userLanguageName}</small></header><p>{turn.userText}</p><div className="translation-line"><Languages /><span><small>{aiLanguageName} çevirisi</small>{turn.userTranslation}</span></div></article>
            <article className="practice-message ai"><header><span><Bot /> AI konuşma partneri</span><small>{aiLanguageName}</small></header><p>{turn.reply}</p><button className="speak-reply" onClick={() => speak(turn.reply)} aria-label="AI cevabını dinle"><Volume2 /></button><div className="translation-line"><Languages /><span><small>{userLanguageName} anlamı</small>{turn.replyTranslation}</span></div></article>
          </div>)}
          {busy && <div className="practice-thinking"><span /><span /><span /><b>Çeviri hazırlanıyor</b></div>}
        </div>

        <div className="practice-compose">
          <form onSubmit={submit}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`${userLanguageName} yazın…`} aria-label="AI deneme mesajı" /><button className="primary" type="submit" disabled={busy || !draft.trim()}><ArrowRight /> Gönder</button></form>
          <button className={`practice-mic ${speech.listening ? "listening" : ""}`} onClick={speech.toggle} disabled={busy}>{speech.listening ? <MicOff /> : <Mic />}<span>{speech.listening ? "Dinlemeyi durdur" : "Konuşarak dene"}</span></button>
          {turns.length > 0 && <button className="practice-reset" onClick={() => { setTurns([]); setError(""); }}><RotateCcw /> Sohbeti temizle</button>}
        </div>
        {(error || speech.error) && <div className="practice-error" role="alert">{error || speech.error}</div>}
      </div>
    </section>
  );
}
