import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight, ArrowUp, Check, Copy, HelpCircle, Keyboard, Maximize2, Mic, MicOff, PhoneCall, PhoneOff,
  RotateCcw, Share2, Type, Users, Volume2, VolumeX, X,
} from "lucide-react";
import type { QueueItem } from "../lib/messageQueue";
import type { RoomMessage } from "../hooks/useRoom";
import Tour, { isTourDone, type TourStep } from "./Tour";
import "../room.css";

export type FeedEntry = {
  id: string;
  mine: boolean;
  original: string;
  translated: string;
  originalLanguage: string;
  translatedLanguage: string;
  at: number;
  status?: QueueItem["status"];
};

export type RoomScreenProps = {
  roomCode: string;
  inviteLink: string;
  connected: boolean;
  connecting: boolean;
  peerLanguage: string | null;
  localMessages: QueueItem[];
  remoteMessages: RoomMessage[];
  languages: readonly (readonly string[])[];
  sourceCode: string;
  onSourceChange: (code: string) => void;
  targetName: string;
  onTargetChange: (name: string) => void;
  targetLocked: boolean;
  listening: boolean;
  interimText: string;
  onToggleMic: () => void;
  micSupported: boolean;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  voiceEnabled: boolean;
  voiceConnected: boolean;
  voiceConnecting: boolean;
  onToggleVoice: () => void;
  remoteMuted: boolean;
  onToggleRemoteAudio: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmitDraft: (event: React.FormEvent) => void;
  onSpeak: (text: string, languageName: string) => void;
  onRetry: (id: string) => void;
  status: string;
  statusIsError: boolean;
  audioSlot: React.ReactNode;
};

const textSizes = ["Normal", "Büyük", "Çok büyük"];

const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

// Öğretici tur adımları. Hedefler ekranın gerçek düğmeleri; biri yoksa
// tur o adımı atlar, akış bozulmaz.
const tourSteps: TourStep[] = [
  {
    target: ".langbar",
    tone: "lang",
    emoji: "🌍",
    title: "Diller",
    body: "Solda sizin konuştuğunuz dil, sağda çeviri dili. Dokununca listeden seçersiniz. Karşı taraf odaya girince onun dili otomatik kilitlenir.",
  },
  {
    target: ".mic-button",
    tone: "mic",
    emoji: "🎤",
    title: "Mikrofon",
    body: "Ana düğme bu. Basın ve normal konuşun; söyledikleriniz anında yazıya dökülüp çevrilir ve karşı tarafa gider. Tekrar basınca durur.",
  },
  {
    target: ".room-bar-actions .icon:nth-of-type(1)",
    tone: "voice",
    emoji: "🔊",
    title: "Otomatik seslendirme",
    body: "Açıkken karşı taraftan gelen her çeviri kendiliğinden sesli okunur. Sessiz ortamdaysanız buradan kapatabilirsiniz.",
  },
  {
    target: ".room-bar-actions .icon:nth-of-type(2)",
    tone: "call",
    emoji: "📞",
    title: "Canlı ses",
    body: "Bu, çevirinin yanında karşı tarafın GERÇEK sesini de duymanızı sağlar. İki taraf da açmalı. Yankıyı önlemek için kulaklık önerilir.",
  },
  {
    target: ".room-controls .round:first-child",
    tone: "text",
    emoji: "⌨️",
    title: "Klavyeyle yaz",
    body: "Konuşamayacağınız bir yerdeyseniz yazarak gönderin. Yazdığınız da aynı şekilde çevrilir.",
  },
  {
    target: ".room-chip",
    tone: "room",
    emoji: "🔗",
    title: "Oda kodu",
    body: "Dokununca davet bağlantısı paylaşılır. Karşı taraf bu bağlantıyla tek dokunuşta odaya katılır.",
  },
  {
    target: ".room-feed",
    tone: "feed",
    emoji: "💬",
    title: "Konuşma akışı",
    body: "Çeviri büyük, orijinal küçük yazılır. Bir balona dokunursanız tekrar okutabilir, tam ekranda gösterebilir veya kopyalayabilirsiniz.",
  },
];

export default function RoomScreen(props: RoomScreenProps) {
  const {
    roomCode, inviteLink, connected, connecting, peerLanguage,
    localMessages, remoteMessages, languages,
    sourceCode, onSourceChange, targetName, onTargetChange, targetLocked,
    listening, interimText, onToggleMic, micSupported,
    autoSpeak, onToggleAutoSpeak,
    voiceEnabled, voiceConnected, voiceConnecting, onToggleVoice,
    remoteMuted, onToggleRemoteAudio,
    draft, onDraftChange, onSubmitDraft, onSpeak, onRetry,
    status, statusIsError, audioSlot,
  } = props;

  const [openEntry, setOpenEntry] = useState<FeedEntry | null>(null);
  const [fullScreen, setFullScreen] = useState<FeedEntry | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [textSize, setTextSize] = useState(() => Number(localStorage.getItem("dilmac-text-size") || 0));
  const feedRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  // İlk gelişte bir kez soruyoruz; cevabı ne olursa olsun bir daha sormuyoruz.
  const [tourMode, setTourMode] = useState<"ask" | "run" | "off">(() => (isTourDone() ? "off" : "ask"));

  useEffect(() => {
    localStorage.setItem("dilmac-text-size", String(textSize));
  }, [textSize]);

  // Görüşme sırasında sayfanın kendisi sabitlenir; yalnızca sohbet akışı
  // kayar. Mobilde adres çubuğu zıplaması ve "sayfayı çekince yenile"
  // davranışı konuşmayı bölüyordu.
  useEffect(() => {
    document.body.classList.add("room-locked");
    return () => document.body.classList.remove("room-locked");
  }, []);

  // Tek akış: benim ve karşı tarafın cümleleri zaman sırasına göre birleşir.
  // Eski iki panelli düzende göz sürekli sağ-sol gidiyordu; konuşma tek
  // sütunda akınca "kim ne dedi" tek bakışta okunuyor.
  const feed = useMemo<FeedEntry[]>(() => {
    const mine: FeedEntry[] = localMessages.map((item) => ({
      id: item.id,
      mine: true,
      original: item.source,
      translated: item.translated,
      originalLanguage: item.sourceLanguage,
      translatedLanguage: item.targetLanguage,
      at: item.sentAt,
      status: item.status,
    }));
    const theirs: FeedEntry[] = remoteMessages.map((item) => ({
      id: item.id,
      mine: false,
      original: item.source,
      translated: item.translated,
      originalLanguage: item.sourceLanguage,
      translatedLanguage: item.targetLanguage,
      at: item.sentAt,
    }));
    return [...mine, ...theirs].sort((a, b) => a.at - b.at);
  }, [localMessages, remoteMessages]);

  useEffect(() => {
    const node = feedRef.current;
    if (!node || !pinnedRef.current) return;
    requestAnimationFrame(() => node.scrollTo({ top: node.scrollHeight, behavior: "smooth" }));
  }, [feed.length, interimText]);

  const onFeedScroll = () => {
    const node = feedRef.current;
    if (!node) return;
    pinnedRef.current = node.scrollHeight - node.scrollTop - node.clientHeight <= 120;
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = async () => {
    if (!inviteLink) return;
    try {
      if (canShare) await navigator.share({ title: "Dilmaç", text: `${roomCode} odasına katıl.`, url: inviteLink });
      else await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* kullanıcı paylaşımı iptal etti */ }
  };

  const peerLabel = connected
    ? `Karşı taraf bağlı${peerLanguage ? ` · ${peerLanguage}` : ""}`
    : connecting ? "Karşı taraf bekleniyor" : "Bağlantı yok";

  return (
    <section className={`room size-${textSize}`} aria-label="Canlı çeviri odası">
      {audioSlot}
      <Tour steps={tourSteps} mode={tourMode} onFinish={() => setTourMode("off")} />

      <header className="room-bar">
        <button className="chip room-chip" type="button" onClick={share}>
          <span className="chip-label">ODA</span>
          <b>{roomCode || "—"}</b>
          {copied ? <Check /> : canShare ? <Share2 /> : <Copy />}
        </button>

        <div className={`chip peer-chip ${connected ? "on" : connecting ? "wait" : ""}`}>
          <i aria-hidden="true" />
          <span>{peerLabel}</span>
        </div>

        <div className="room-bar-actions">
          <button
            type="button"
            className={`icon ${autoSpeak ? "on" : ""}`}
            onClick={onToggleAutoSpeak}
            aria-pressed={autoSpeak}
            title={autoSpeak ? "Otomatik seslendirme açık" : "Otomatik seslendirme kapalı"}
          >
            {autoSpeak ? <Volume2 /> : <VolumeX />}
            <small>Oto ses</small>
          </button>
          <button
            type="button"
            className={`icon ${voiceConnected ? "on" : voiceEnabled ? "wait" : ""}`}
            onClick={onToggleVoice}
            disabled={voiceConnecting && !voiceEnabled}
            title={voiceEnabled ? "Canlı sesi kapat" : "Canlı sesi aç"}
          >
            {voiceEnabled ? <PhoneOff /> : <PhoneCall />}
            <small>Canlı ses</small>
          </button>
          <button type="button" className="icon" onClick={() => setShowSettings(true)} title="Yazı boyutu">
            <Type />
            <small>Boyut</small>
          </button>
          <button type="button" className="icon" onClick={() => setTourMode("run")} title="Düğmeleri anlat">
            <HelpCircle />
            <small>Tur</small>
          </button>
        </div>
      </header>

      {/* Diller her zaman görünür ve doğrudan dokunulabilir. Ayarlar
          menüsünün içine saklandığında kullanıcı yanlış dille konuşuyordu. */}
      <div className="langbar">
        <label className="langbar-side">
          <small>SİZ</small>
          <b>{languages.find(([code]) => code === sourceCode)?.[1] || sourceCode}</b>
          <select value={sourceCode} onChange={(event) => onSourceChange(event.target.value)} aria-label="Konuştuğunuz dil">
            {languages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <span className="langbar-swap" aria-hidden="true"><ArrowLeftRight /></span>
        <label className={`langbar-side ${targetLocked ? "locked" : ""}`}>
          <small>{targetLocked ? "KARŞI TARAF" : "ÇEVİRİ"}</small>
          <b>{targetName}</b>
          {!targetLocked && (
            <select value={targetName} onChange={(event) => onTargetChange(event.target.value)} aria-label="Çeviri dili">
              {languages.map(([code, name]) => <option key={code} value={name}>{name}</option>)}
            </select>
          )}
        </label>
      </div>

      <div className="room-feed" ref={feedRef} onScroll={onFeedScroll}>
        {feed.length === 0 && !interimText && (
          <div className="room-empty">
            <Users />
            <h2>{connected ? "Konuşmaya başlayın" : "Karşı taraf bekleniyor"}</h2>
            <p>
              {connected
                ? "Mikrofona basıp konuşun. Söyledikleriniz çevrilip karşı tarafta sesli okunur."
                : "Oda kodunu paylaşın. İkinci kişi katıldığında burası canlanır."}
            </p>
            {!connected && inviteLink && (
              <button className="room-invite" type="button" onClick={share}>
                <Share2 /> Davet bağlantısını paylaş
              </button>
            )}
          </div>
        )}

        {feed.map((entry, i) => (
          <article
            key={entry.id}
            className={`turn ${entry.mine ? "mine" : "theirs"} ${entry.status ? `is-${entry.status}` : ""} ${i > 0 && feed[i - 1].mine === entry.mine ? "grouped" : "first-of-group"}`}
            onClick={() => setOpenEntry(entry)}
          >
            {(i === 0 || feed[i - 1].mine !== entry.mine) && (
              <span className="turn-who">{entry.mine ? "Siz" : peerLanguage ? `Karşı taraf · ${entry.originalLanguage}` : "Karşı taraf"}</span>
            )}
            {entry.mine ? (
              <>
                <p className="turn-main">{entry.original}</p>
                {entry.translated && entry.translated !== entry.original && <p className="turn-sub">{entry.translated}</p>}
                <span className="turn-meta">
                  {entry.status === "queued" && "Sırada"}
                  {entry.status === "translating" && "Çevriliyor…"}
                  {entry.status === "sent" && "Gönderildi"}
                  {entry.status === "delivered" && `Teslim edildi · ${timeOf(entry.at)}`}
                  {entry.status === "failed" && "Gönderilemedi"}
                </span>
                {entry.status === "failed" && (
                  <button
                    className="turn-retry"
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onRetry(entry.id); }}
                  >
                    <RotateCcw /> Tekrar dene
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="turn-main">{entry.translated}</p>
                {entry.original !== entry.translated && <p className="turn-sub">{entry.original}</p>}
                <span className="turn-meta">{timeOf(entry.at)}</span>
              </>
            )}
          </article>
        ))}

        {interimText && (
          <article className="turn mine ghost" aria-live="polite">
            <p className="turn-main">{interimText}<i className="caret" /></p>
          </article>
        )}
      </div>

      {/* Tek durum satırı. Eskiden spinner + banner + uyarı aynı anda vardı. */}
      <p className={`room-status ${statusIsError ? "error" : ""}`} role="status" aria-live="polite">{status}</p>

      <div className="room-controls">
        <button
          type="button"
          className="round"
          onClick={() => setShowKeyboard((value) => !value)}
          title="Klavyeyle yaz"
        >
          <Keyboard />
        </button>

        <button
          type="button"
          className={`mic-button ${listening ? "live" : ""}`}
          onClick={onToggleMic}
          disabled={!micSupported}
          aria-pressed={listening}
        >
          {listening ? <MicOff /> : <Mic />}
          <span>{listening ? "Durdur" : "Konuş"}</span>
        </button>

        <button
          type="button"
          className={`round ${remoteMuted ? "" : "on"}`}
          onClick={onToggleRemoteAudio}
          disabled={!voiceConnected}
          title={remoteMuted ? "Karşı tarafın sesini aç" : "Karşı tarafın sesini kapat"}
        >
          {remoteMuted ? <VolumeX /> : <Volume2 />}
        </button>
      </div>

      {showKeyboard && (
        <form className="room-composer" onSubmit={(event) => { onSubmitDraft(event); setShowKeyboard(false); }}>
          <input
            autoFocus
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Yazın, çevrilip gönderilsin…"
            aria-label="Çevrilecek mesaj"
          />
          <button className="round send" type="submit" disabled={!draft.trim()}><ArrowUp /></button>
        </form>
      )}

      {openEntry && (
        <div className="sheet-backdrop" onClick={() => setOpenEntry(null)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-grip" aria-hidden="true" />
            <p className="sheet-text">{openEntry.mine ? openEntry.translated || openEntry.original : openEntry.translated}</p>
            <div className="sheet-actions">
              <button type="button" onClick={() => { onSpeak(openEntry.mine ? openEntry.translated : openEntry.translated, openEntry.translatedLanguage); setOpenEntry(null); }}>
                <Volume2 /> Tekrar oku
              </button>
              <button type="button" onClick={() => { setFullScreen(openEntry); setOpenEntry(null); }}>
                <Maximize2 /> Tam ekran
              </button>
              <button type="button" onClick={() => { void navigator.clipboard.writeText(openEntry.translated || openEntry.original); setOpenEntry(null); }}>
                <Copy /> Kopyala
              </button>
            </div>
          </div>
        </div>
      )}

      {fullScreen && (
        <div className="takeover" onClick={() => setFullScreen(null)}>
          <button className="takeover-close" type="button" aria-label="Kapat"><X /></button>
          <p>{fullScreen.mine ? fullScreen.translated : fullScreen.translated}</p>
          <small>{fullScreen.mine ? fullScreen.original : fullScreen.original}</small>
        </div>
      )}

      {showSettings && (
        <div className="sheet-backdrop" onClick={() => setShowSettings(false)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-grip" aria-hidden="true" />
            <h3>Yazı boyutu</h3>
            <div className="sheet-sizes">
              {textSizes.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={index === textSize ? "on" : ""}
                  onClick={() => setTextSize(index)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="sheet-done" type="button" onClick={() => setShowSettings(false)}>Tamam</button>
          </div>
        </div>
      )}
    </section>
  );
}
