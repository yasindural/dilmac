import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight, ArrowUp, Check, Copy, HelpCircle, Keyboard, Maximize2, Mic, MicOff, PhoneCall, PhoneOff,
  RotateCcw, Share2, Type, Users, Volume2, VolumeX, X,
} from "lucide-react";
import type { QueueItem } from "../lib/messageQueue";
import type { RoomMessage } from "../hooks/useRoom";
import Tour, { isTourDone, type TourStep } from "./Tour";
import LanguagePicker from "./LanguagePicker";
import { useI18n } from "../lib/i18n";
import { languageByName } from "../lib/languages";
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
  sourceCode: string;
  onSourceChange: (code: string) => void;
  targetName: string;
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



const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

// Öğretici tur adımları. Hedefler ekranın gerçek düğmeleri; biri yoksa
// tur o adımı atlar, akış bozulmaz.

export default function RoomScreen(props: RoomScreenProps) {
  const { t } = useI18n();
  const tourSteps: TourStep[] = useMemo(() => [
    { target: ".langbar", tone: "lang", emoji: "🌍", title: t("tour.s1t"), body: t("tour.s1b") },
    { target: ".mic-button", tone: "mic", emoji: "🎤", title: t("tour.s2t"), body: t("tour.s2b") },
    { target: "[data-tour='auto']", tone: "voice", emoji: "🔊", title: t("tour.s3t"), body: t("tour.s3b") },
    { target: "[data-tour='voice']", tone: "call", emoji: "📞", title: t("tour.s4t"), body: t("tour.s4b") },
    { target: "[data-tour='keyboard']", tone: "text", emoji: "⌨️", title: t("tour.s5t"), body: t("tour.s5b") },
    { target: "[data-tour='room']", tone: "room", emoji: "🔗", title: t("tour.s6t"), body: t("tour.s6b") },
    { target: ".room-feed", tone: "feed", emoji: "💬", title: t("tour.s7t"), body: t("tour.s7b") },
  ], [t]);
  const {
    roomCode, inviteLink, connected, connecting, peerLanguage,
    localMessages, remoteMessages,
    sourceCode, onSourceChange, targetName, targetLocked,
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

  // Birleştirilen mesaj yeni baloncuk açmadan uzar; akışın dibinde kalmak
  // için mesaj sayısıyla birlikte son mesajın uzunluğu da izlenir.
  const lastEntry = feed[feed.length - 1];
  const lastEntryGrowth = lastEntry ? lastEntry.original.length + lastEntry.translated.length : 0;
  useEffect(() => {
    const node = feedRef.current;
    if (!node || !pinnedRef.current) return;
    requestAnimationFrame(() => node.scrollTo({ top: node.scrollHeight, behavior: "smooth" }));
  }, [feed.length, interimText, lastEntryGrowth]);

  const onFeedScroll = () => {
    const node = feedRef.current;
    if (!node) return;
    pinnedRef.current = node.scrollHeight - node.scrollTop - node.clientHeight <= 120;
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = async () => {
    if (!inviteLink) return;
    try {
      if (canShare) await navigator.share({ title: "Dilmaç", text: t("room.inviteText", { room: roomCode }), url: inviteLink });
      else await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* kullanıcı paylaşımı iptal etti */ }
  };

  const peerLabel = connected
    ? peerLanguage
      ? t("room.peerConnectedLang", { language: peerLanguage })
      : t("room.peerConnected")
    : connecting ? t("room.waitTitle") : t("room.noConn");

  return (
    <section className={`room size-${textSize}`} aria-label={t("room.aria")}>
      {audioSlot}
      <Tour steps={tourSteps} mode={tourMode} onFinish={() => setTourMode("off")} />

      <header className="room-bar">
        <button className="chip room-chip" type="button" onClick={share} data-tour="room">
          <span className="chip-label">{t("room.roomLabel")}</span>
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
            title={autoSpeak ? t("room.autoOn") : t("room.autoOff")}
            data-tour="auto"
          >
            {autoSpeak ? <Volume2 /> : <VolumeX />}
            <small>{t("room.autoLabel")}</small>
          </button>
          <button
            type="button"
            className={`icon ${voiceConnected ? "on" : voiceEnabled ? "wait" : ""}`}
            onClick={onToggleVoice}
            disabled={voiceConnecting && !voiceEnabled}
            title={voiceEnabled ? t("room.voiceOff") : t("room.voiceOn")}
            data-tour="voice"
          >
            {voiceEnabled ? <PhoneOff /> : <PhoneCall />}
            <small>{t("room.voiceLabel")}</small>
          </button>
          <button type="button" className="icon" onClick={() => setShowSettings(true)} title={t("room.sizeAria")}>
            <Type />
            <small>{t("room.sizeLabel")}</small>
          </button>
          <button type="button" className="icon" onClick={() => setTourMode("run")} title={t("room.tourAria")}>
            <HelpCircle />
            <small>{t("room.tourLabel")}</small>
          </button>
        </div>
      </header>

      {/* Diller her zaman görünür ve doğrudan dokunulabilir. Ayarlar
          menüsünün içine saklandığında kullanıcı yanlış dille konuşuyordu. */}
      <div className="langbar">
        <LanguagePicker
          value={sourceCode}
          onChange={onSourceChange}
          label={t("room.you")}
        />
        <span className="langbar-swap" aria-hidden="true"><ArrowLeftRight /></span>
        <LanguagePicker
          value={languageByName(targetName)?.code || ""}
          onChange={() => undefined}
          label={targetLocked ? t("room.peerSide") : t("room.target")}
          disabled={targetLocked}
          placeholder={t("room.waitTitle")}
          align="end"
        />
      </div>

      <div className="room-feed" ref={feedRef} onScroll={onFeedScroll}>
        {feed.length === 0 && !interimText && (
          <div className="room-empty">
            <Users />
            <h2>{connected ? t("room.startTitle") : t("room.waitTitle")}</h2>
            <p>
              {connected
                ? t("room.startText")
                : t("room.waitText")}
            </p>
            {!connected && inviteLink && (
              <button className="room-invite" type="button" onClick={share}>
                <Share2 /> {t("room.share")}
              </button>
            )}
          </div>
        )}

        {feed.map((entry, i) => (
          <article
            key={entry.id}
            className={`turn ${entry.mine ? "mine" : "theirs"} ${entry.status ? `is-${entry.status}` : ""} ${i > 0 && feed[i - 1].mine === entry.mine ? "grouped" : "first-of-group"} ${(entry.mine ? entry.original : entry.translated).length > 160 ? "longform" : ""}`}
            onClick={() => setOpenEntry(entry)}
          >
            {(i === 0 || feed[i - 1].mine !== entry.mine) && (
              <span className="turn-who">{entry.mine ? t("room.mine") : peerLanguage ? `${t("room.peer")} · ${languageByName(entry.originalLanguage)?.name || entry.originalLanguage}` : t("room.peer")}</span>
            )}
            {entry.mine ? (
              <>
                <p className="turn-main">{entry.original}</p>
                {entry.translated && entry.translated !== entry.original && <p className="turn-sub">{entry.translated}</p>}
                <span className="turn-meta">
                  {entry.status === "queued" && t("room.queued")}
                  {entry.status === "translating" && t("room.translating")}
                  {entry.status === "sent" && t("room.sent")}
                  {entry.status === "delivered" && `${t("room.delivered")} · ${timeOf(entry.at)}`}
                  {entry.status === "failed" && t("room.failed")}
                </span>
                {entry.status === "failed" && (
                  <button
                    className="turn-retry"
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onRetry(entry.id); }}
                  >
                    <RotateCcw /> {t("room.retry")}
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
          <article className={`turn mine ghost ${interimText.length > 160 ? "longform" : ""}`} aria-live="polite">
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
          title={t("room.keyboard")}
          data-tour="keyboard"
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
          <span>{listening ? t("room.stop") : t("room.speak")}</span>
        </button>

        <button
          type="button"
          className={`round ${remoteMuted ? "" : "on"}`}
          onClick={onToggleRemoteAudio}
          disabled={!voiceConnected}
          title={remoteMuted ? t("room.unmuteRemote") : t("room.muteRemote")}
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
            placeholder={t("room.composePh")}
            aria-label={t("room.composeAria")}
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
                <Volume2 /> {t("room.speakAgain")}
              </button>
              <button type="button" onClick={() => { setFullScreen(openEntry); setOpenEntry(null); }}>
                <Maximize2 /> {t("room.fullscreen")}
              </button>
              <button type="button" onClick={() => { void navigator.clipboard.writeText(openEntry.translated || openEntry.original); setOpenEntry(null); }}>
                <Copy /> {t("room.copy")}
              </button>
            </div>
          </div>
        </div>
      )}

      {fullScreen && (
        <div className="takeover" onClick={() => setFullScreen(null)}>
          <button className="takeover-close" type="button" aria-label={t("room.close")}><X /></button>
          <p>{fullScreen.mine ? fullScreen.translated : fullScreen.translated}</p>
          <small>{fullScreen.mine ? fullScreen.original : fullScreen.original}</small>
        </div>
      )}

      {showSettings && (
        <div className="sheet-backdrop" onClick={() => setShowSettings(false)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-grip" aria-hidden="true" />
            <h3>{t("room.sizeAria")}</h3>
            <div className="sheet-sizes">
              {[t("room.sizeNormal"), t("room.sizeBig"), t("room.sizeHuge")].map((label, index) => (
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
            <button className="sheet-done" type="button" onClick={() => setShowSettings(false)}>{t("room.done")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
