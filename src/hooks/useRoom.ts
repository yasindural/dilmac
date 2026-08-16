import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";

export type RoomMessage = {
  id: string;
  source: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  sentAt: number;
  // Konuşmacı duraksayıp devam ettiğinde mesaj aynı kimlikle güncellenir;
  // appended yalnızca yeni eklenen çeviri parçasıdır (alıcı sadece bunu seslendirir).
  appended?: string;
};

export type RoomLanguage = { code: string; name: string };

type Role = "host" | "guest";
type Envelope =
  | { kind: "message"; message: RoomMessage; protocol?: 2 }
  | { kind: "ack"; id: string }
  | { kind: "voice-ready"; ready: boolean }
  | { kind: "language"; language: RoomLanguage; protocol?: 2 }
  | { kind: "speaking"; on: boolean };

function isRoomMessage(value: unknown): value is RoomMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<RoomMessage>;
  return typeof message.id === "string" && message.id.length > 0
    && typeof message.source === "string" && message.source.trim().length > 0
    && typeof message.translated === "string" && message.translated.trim().length > 0
    && typeof message.sourceLanguage === "string" && message.sourceLanguage.length > 0
    && typeof message.targetLanguage === "string" && message.targetLanguage.length > 0
    && typeof message.sentAt === "number";
}

function isRoomLanguage(value: unknown): value is RoomLanguage {
  if (!value || typeof value !== "object") return false;
  const language = value as Partial<RoomLanguage>;
  return typeof language.code === "string" && language.code.length > 0
    && typeof language.name === "string" && language.name.length > 0;
}

export function useRoom(onMessage: (message: RoomMessage) => void, onDelivered?: (id: string) => void, onRemoteLanguage?: (language: RoomLanguage) => void) {
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const mediaConnectionRef = useRef<MediaConnection | null>(null);
  const pendingIncomingCallRef = useRef<MediaConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roleRef = useRef<Role | null>(null);
  const hostIdRef = useRef("");
  const remoteVoiceReadyRef = useRef(false);
  const voiceCallInFlightRef = useRef(false);
  const voiceReconnectTimerRef = useRef<number | null>(null);
  const guestReconnectTimerRef = useRef<number | null>(null);
  const guestConnectTimeoutRef = useRef<number | null>(null);
  const guestReconnectAttemptRef = useRef(0);
  const scheduleGuestReconnectRef = useRef<(delay?: number) => void>(() => undefined);
  const bindMediaConnectionRef = useRef<(connection: MediaConnection) => void>(() => undefined);
  const maybeStartGuestCallRef = useRef<() => void>(() => undefined);
  const onMessageRef = useRef(onMessage);
  const onDeliveredRef = useRef(onDelivered);
  const onRemoteLanguageRef = useRef(onRemoteLanguage);
  const localLanguageRef = useRef<RoomLanguage | null>(null);
  const outboundRef = useRef<RoomMessage[]>([]);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const remoteSpeakingTimerRef = useRef<number | null>(null);
  const speakingHeartbeatTimerRef = useRef<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [remoteVoiceReady, setRemoteVoiceReady] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onDeliveredRef.current = onDelivered; }, [onDelivered]);
  useEffect(() => { onRemoteLanguageRef.current = onRemoteLanguage; }, [onRemoteLanguage]);

  const clearVoiceReconnectTimer = useCallback(() => {
    if (voiceReconnectTimerRef.current === null) return;
    window.clearTimeout(voiceReconnectTimerRef.current);
    voiceReconnectTimerRef.current = null;
  }, []);

  const clearGuestConnectionTimers = useCallback(() => {
    if (guestReconnectTimerRef.current !== null) window.clearTimeout(guestReconnectTimerRef.current);
    if (guestConnectTimeoutRef.current !== null) window.clearTimeout(guestConnectTimeoutRef.current);
    guestReconnectTimerRef.current = null;
    guestConnectTimeoutRef.current = null;
  }, []);

  const clearSpeakingHeartbeat = useCallback(() => {
    if (speakingHeartbeatTimerRef.current === null) return;
    window.clearInterval(speakingHeartbeatTimerRef.current);
    speakingHeartbeatTimerRef.current = null;
  }, []);

  const closeMediaConnection = useCallback(() => {
    clearVoiceReconnectTimer();
    voiceCallInFlightRef.current = false;
    const mediaConnection = mediaConnectionRef.current;
    const pendingIncomingCall = pendingIncomingCallRef.current;
    mediaConnectionRef.current = null;
    pendingIncomingCallRef.current = null;
    if (mediaConnection) mediaConnection.close();
    if (pendingIncomingCall && pendingIncomingCall !== mediaConnection) pendingIncomingCall.close();
    setRemoteStream(null);
    setVoiceConnecting(false);
  }, [clearVoiceReconnectTimer]);

  const disableVoice = useCallback(() => {
    clearSpeakingHeartbeat();
    if (connectionRef.current?.open) {
      connectionRef.current.send({ kind: "speaking", on: false } satisfies Envelope);
      connectionRef.current.send({ kind: "voice-ready", ready: false } satisfies Envelope);
    }
    closeMediaConnection();
    for (const track of localStreamRef.current?.getTracks() ?? []) track.stop();
    localStreamRef.current = null;
    setVoiceEnabled(false);
    setVoiceError("");
  }, [clearSpeakingHeartbeat, closeMediaConnection]);

  const close = useCallback(() => {
    roleRef.current = null;
    hostIdRef.current = "";
    remoteVoiceReadyRef.current = false;
    guestReconnectAttemptRef.current = 0;
    setRemoteVoiceReady(false);
    disableVoice();
    clearGuestConnectionTimers();
    connectionRef.current?.close();
    peerRef.current?.destroy();
    connectionRef.current = null;
    peerRef.current = null;
    clearVoiceReconnectTimer();
    setConnected(false);
    setConnecting(false);
  }, [clearGuestConnectionTimers, clearVoiceReconnectTimer, disableVoice]);

  useEffect(() => close, [close]);

  const scheduleGuestVoiceReconnect = useCallback(() => {
    clearVoiceReconnectTimer();
    voiceReconnectTimerRef.current = window.setTimeout(() => {
      voiceReconnectTimerRef.current = null;
      maybeStartGuestCallRef.current();
    }, 750);
  }, [clearVoiceReconnectTimer]);

  const bindMediaConnection = useCallback((mediaConnection: MediaConnection) => {
    if (mediaConnectionRef.current && mediaConnectionRef.current !== mediaConnection) {
      mediaConnection.close();
      return;
    }
    mediaConnectionRef.current = mediaConnection;
    voiceCallInFlightRef.current = true;
    setVoiceConnecting(true);
    setVoiceError("");

    mediaConnection.on("stream", (stream) => {
      if (mediaConnectionRef.current !== mediaConnection) return;
      pendingIncomingCallRef.current = null;
      voiceCallInFlightRef.current = false;
      setRemoteStream(stream);
      setVoiceConnecting(false);
      setVoiceError("");
      for (const track of stream.getAudioTracks()) {
        track.addEventListener("ended", () => {
          if (mediaConnectionRef.current !== mediaConnection) return;
          setRemoteStream(null);
          setVoiceConnecting(false);
        }, { once: true });
      }
    });

    mediaConnection.on("close", () => {
      const isCurrentConnection = mediaConnectionRef.current === mediaConnection
        || pendingIncomingCallRef.current === mediaConnection;
      if (!isCurrentConnection) return;
      if (mediaConnectionRef.current === mediaConnection) mediaConnectionRef.current = null;
      if (pendingIncomingCallRef.current === mediaConnection) pendingIncomingCallRef.current = null;
      voiceCallInFlightRef.current = false;
      setRemoteStream(null);
      setVoiceConnecting(false);
      scheduleGuestVoiceReconnect();
    });

    mediaConnection.on("error", () => {
      const isCurrentConnection = mediaConnectionRef.current === mediaConnection
        || pendingIncomingCallRef.current === mediaConnection;
      if (!isCurrentConnection) return;
      if (mediaConnectionRef.current === mediaConnection) mediaConnectionRef.current = null;
      if (pendingIncomingCallRef.current === mediaConnection) pendingIncomingCallRef.current = null;
      voiceCallInFlightRef.current = false;
      setRemoteStream(null);
      setVoiceConnecting(false);
      setVoiceError("Canlı ses bağlantısı kurulamadı. Mikrofon iznini ve internet bağlantınızı kontrol edin.");
      scheduleGuestVoiceReconnect();
    });
  }, [scheduleGuestVoiceReconnect]);
  bindMediaConnectionRef.current = bindMediaConnection;

  const maybeStartGuestCall = useCallback(() => {
    const peer = peerRef.current;
    const localStream = localStreamRef.current;
    if (roleRef.current !== "guest"
      || !peer
      || peer.destroyed
      || !peer.open
      || !connectionRef.current?.open
      || !localStream
      || !remoteVoiceReadyRef.current
      || mediaConnectionRef.current
      || voiceCallInFlightRef.current) return;

    voiceCallInFlightRef.current = true;
    setVoiceConnecting(true);
    setVoiceError("");
    try {
      const mediaConnection = peer.call(hostIdRef.current, localStream);
      bindMediaConnectionRef.current(mediaConnection);
    } catch {
      voiceCallInFlightRef.current = false;
      setVoiceConnecting(false);
      setVoiceError("Canlı ses bağlantısı başlatılamadı. Birkaç saniye sonra yeniden deneyin.");
      scheduleGuestVoiceReconnect();
    }
  }, [scheduleGuestVoiceReconnect]);
  maybeStartGuestCallRef.current = maybeStartGuestCall;

  const enableVoice = useCallback(async () => {
    if (localStreamRef.current) {
      if (connectionRef.current?.open) {
        connectionRef.current.send({ kind: "voice-ready", ready: true } satisfies Envelope);
      }
      maybeStartGuestCall();
      return true;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Bu tarayıcı canlı mikrofon paylaşımını desteklemiyor.");
      return false;
    }

    setVoiceConnecting(true);
    setVoiceError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      setVoiceEnabled(true);
      if (connectionRef.current?.open) {
        connectionRef.current.send({ kind: "voice-ready", ready: true } satisfies Envelope);
      }

      const pendingIncomingCall = pendingIncomingCallRef.current;
      if (roleRef.current === "host" && pendingIncomingCall) {
        setVoiceConnecting(true);
        pendingIncomingCall.answer(stream);
      } else {
        setVoiceConnecting(false);
        maybeStartGuestCall();
      }
      return true;
    } catch (microphoneError) {
      const permissionDenied = microphoneError instanceof DOMException
        && (microphoneError.name === "NotAllowedError" || microphoneError.name === "PermissionDeniedError");
      setVoiceConnecting(false);
      setVoiceEnabled(false);
      setVoiceError(permissionDenied
        ? "Karşı tarafın sesini paylaşmak için mikrofon iznine izin verin."
        : "Mikrofon açılamadı. Başka bir uygulamanın mikrofonu kullanmadığını kontrol edin.");
      return false;
    }
  }, [maybeStartGuestCall]);

  const bindConnection = useCallback((connection: DataConnection) => {
    connectionRef.current = connection;
    connection.on("open", () => {
      if (connectionRef.current !== connection) return;
      if (guestConnectTimeoutRef.current !== null) window.clearTimeout(guestConnectTimeoutRef.current);
      guestConnectTimeoutRef.current = null;
      if (guestReconnectTimerRef.current !== null) window.clearTimeout(guestReconnectTimerRef.current);
      guestReconnectTimerRef.current = null;
      guestReconnectAttemptRef.current = 0;
      setConnected(true);
      setConnecting(false);
      setError("");
      for (const message of outboundRef.current) connection.send({ kind: "message", message } satisfies Envelope);
      connection.send({ kind: "voice-ready", ready: Boolean(localStreamRef.current) } satisfies Envelope);
      if (localLanguageRef.current) connection.send({ kind: "language", language: localLanguageRef.current, protocol: 2 } satisfies Envelope);
      maybeStartGuestCall();
    });
    connection.on("data", (data) => {
      const envelope = data as Envelope;
      if (envelope.kind === "ack") {
        outboundRef.current = outboundRef.current.filter((message) => message.id !== envelope.id);
        onDeliveredRef.current?.(envelope.id);
        return;
      }
      if (envelope.kind === "voice-ready") {
        remoteVoiceReadyRef.current = envelope.ready;
        setRemoteVoiceReady(envelope.ready);
        if (envelope.ready) maybeStartGuestCall();
        else closeMediaConnection();
        return;
      }
      if (envelope.kind === "speaking") {
        if (remoteSpeakingTimerRef.current !== null) window.clearTimeout(remoteSpeakingTimerRef.current);
        remoteSpeakingTimerRef.current = null;
        if (envelope.on) {
          setRemoteSpeaking(true);
          remoteSpeakingTimerRef.current = window.setTimeout(() => setRemoteSpeaking(false), 6000);
        } else {
          remoteSpeakingTimerRef.current = window.setTimeout(() => setRemoteSpeaking(false), 700);
        }
        return;
      }
      if (envelope.kind === "language") {
        if (isRoomLanguage(envelope.language)) onRemoteLanguageRef.current?.(envelope.language);
        return;
      }
      if (envelope.kind === "message") {
        if (!isRoomMessage(envelope.message)) {
          setError("Karşı taraftan geçersiz veya boş bir mesaj geldi. Her iki sayfayı da yenileyin.");
          return;
        }
        onMessageRef.current(envelope.message);
        if (connection.open) connection.send({ kind: "ack", id: envelope.message.id } satisfies Envelope);
        return;
      }
      if (isRoomMessage(data)) {
        onMessageRef.current(data);
        if (connection.open) connection.send({ kind: "ack", id: data.id } satisfies Envelope);
      }
    });
    connection.on("close", () => {
      if (connectionRef.current !== connection) return;
      setConnected(false);
      if (roleRef.current === "guest") {
        setConnecting(true);
        scheduleGuestReconnectRef.current();
      }
    });
    connection.on("error", () => {
      if (connectionRef.current !== connection) return;
      setConnected(false);
      if (roleRef.current === "guest") {
        setConnecting(true);
        setError("");
        scheduleGuestReconnectRef.current();
        return;
      }
      setError("Karşı tarafla bağlantı kesildi. Bağlantıyı yeniden açın.");
    });
  }, [closeMediaConnection, maybeStartGuestCall]);

  const handleIncomingMediaConnection = useCallback((mediaConnection: MediaConnection) => {
    if (roleRef.current !== "host") {
      mediaConnection.close();
      return;
    }
    if (mediaConnectionRef.current && mediaConnectionRef.current !== mediaConnection) {
      mediaConnection.close();
      return;
    }

    remoteVoiceReadyRef.current = true;
    setRemoteVoiceReady(true);
    bindMediaConnection(mediaConnection);
    const localStream = localStreamRef.current;
    if (localStream) {
      mediaConnection.answer(localStream);
    } else {
      pendingIncomingCallRef.current = mediaConnection;
      setVoiceConnecting(false);
    }
  }, [bindMediaConnection]);

  const join = useCallback((room: string, role: Role) => {
    close();
    setConnecting(true);
    setError("");
    setVoiceError("");
    roleRef.current = role;
    const hostId = `dilmac-${room.toLowerCase()}-host`;
    hostIdRef.current = hostId;
    const peerOptions: ConstructorParameters<typeof Peer>[1] = { debug: 0 };
    try {
      const override = localStorage.getItem("dilmac-peer-server");
      if (override) {
        const cfg = JSON.parse(override) as { host?: string; port?: number; path?: string; secure?: boolean };
        if (cfg.host) Object.assign(peerOptions, { host: cfg.host, port: cfg.port ?? 9000, path: cfg.path ?? "/", secure: cfg.secure ?? false });
      }
    } catch { /* bozuk değer üretim davranışını etkilemesin */ }
    const peer = role === "host"
      ? new Peer(hostId, peerOptions)
      : new Peer(peerOptions);
    peerRef.current = peer;

    const scheduleGuestReconnect = (delay?: number) => {
      if (roleRef.current !== "guest" || peer.destroyed || connectionRef.current?.open) return;
      if (guestReconnectTimerRef.current !== null) window.clearTimeout(guestReconnectTimerRef.current);
      const attempt = guestReconnectAttemptRef.current;
      const waitMs = delay ?? Math.min(700 + attempt * 700, 5000);
      guestReconnectTimerRef.current = window.setTimeout(() => {
        guestReconnectTimerRef.current = null;
        connectGuest();
      }, waitMs);
    };
    scheduleGuestReconnectRef.current = scheduleGuestReconnect;

    const connectGuest = () => {
      if (roleRef.current !== "guest" || peer.destroyed || !peer.open || connectionRef.current?.open) return;
      if (guestReconnectTimerRef.current !== null) window.clearTimeout(guestReconnectTimerRef.current);
      guestReconnectTimerRef.current = null;
      if (guestConnectTimeoutRef.current !== null) window.clearTimeout(guestConnectTimeoutRef.current);
      guestConnectTimeoutRef.current = null;
      guestReconnectAttemptRef.current += 1;
      setConnecting(true);
      setError("");

      const stale = connectionRef.current;
      if (stale && !stale.open) stale.close();
      const connection = peer.connect(hostId, { reliable: true });
      bindConnection(connection);
      guestConnectTimeoutRef.current = window.setTimeout(() => {
        guestConnectTimeoutRef.current = null;
        if (connectionRef.current !== connection || connection.open) return;
        connection.close();
        scheduleGuestReconnect();
      }, 6500);
    };

    peer.on("open", () => {
      if (role === "guest") connectGuest();
    });
    peer.on("disconnected", () => {
      setConnected(false);
      setConnecting(true);
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on("connection", bindConnection);
    peer.on("call", handleIncomingMediaConnection);
    peer.on("error", (peerError) => {
      const guestWaitingForHost = roleRef.current === "guest" && !connectionRef.current?.open;
      if (peerError.type === "peer-unavailable" && guestWaitingForHost) {
        setConnected(false);
        setConnecting(true);
        setError("");
        scheduleGuestReconnect(900);
        return;
      }
      if (peerError.type === "webrtc" && guestWaitingForHost) {
        setConnected(false);
        setConnecting(true);
        setError("");
        scheduleGuestReconnect(1200);
        return;
      }
      if (peerError.type === "webrtc"
        || (peerError.type === "peer-unavailable" && Boolean(connectionRef.current?.open))) {
        setVoiceConnecting(false);
        setVoiceError("Canlı ses bağlantısı kurulamadı. İki tarafın da ses bağlantısını açtığından emin olun.");
        return;
      }
      setConnecting(false);
      setConnected(false);
      setError(peerError.type === "unavailable-id"
        ? "Bu oda başka bir sekmede açık görünüyor. Eski oda sekmesini kapatıp yeniden deneyin."
        : "Oda bağlantısı kurulamadı. İnternet bağlantınızı kontrol edin.");
    });
  }, [bindConnection, close, handleIncomingMediaConnection]);

  const send = useCallback((message: RoomMessage) => {
    const existingIndex = outboundRef.current.findIndex((candidate) => candidate.id === message.id);
    if (existingIndex >= 0) outboundRef.current[existingIndex] = message;
    else outboundRef.current.push(message);
    if (!connectionRef.current?.open) return false;
    connectionRef.current.send({ kind: "message", message, protocol: 2 } satisfies Envelope);
    return true;
  }, []);

  const sendLanguage = useCallback((language: RoomLanguage) => {
    localLanguageRef.current = language;
    if (!connectionRef.current?.open) return false;
    connectionRef.current.send({ kind: "language", language, protocol: 2 } satisfies Envelope);
    return true;
  }, []);

  const sendSpeaking = useCallback((on: boolean) => {
    if (!on) clearSpeakingHeartbeat();
    if (!connectionRef.current?.open) return false;
    connectionRef.current.send({ kind: "speaking", on } satisfies Envelope);
    if (on && speakingHeartbeatTimerRef.current === null) {
      speakingHeartbeatTimerRef.current = window.setInterval(() => {
        const connection = connectionRef.current;
        if (!connection?.open) {
          clearSpeakingHeartbeat();
          return;
        }
        connection.send({ kind: "speaking", on: true } satisfies Envelope);
      }, 1800);
    }
    return true;
  }, [clearSpeakingHeartbeat]);

  return {
    remoteSpeaking,
    sendSpeaking,
    connected,
    connecting,
    error,
    join,
    send,
    sendLanguage,
    close,
    voiceEnabled,
    remoteVoiceReady,
    voiceConnected: Boolean(remoteStream),
    voiceConnecting,
    voiceError,
    remoteStream,
    enableVoice,
    disableVoice,
  };
}
