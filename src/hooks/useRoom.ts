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
  // Sıra bildirimi: karşı taraf o an konuşuyor mu? Canlı ses açıkken iki
  // cihaz birbirini hoparlörden duyabildiği için, konuşan tarafın sesi
  // diğerinin mikrofonuna girip yanlış çeviri üretiyordu. Bu sinyalle
  // dinleyen taraf kendi tanıyıcısının çıktısını yok sayar.
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
  const bindMediaConnectionRef = useRef<(connection: MediaConnection) => void>(() => undefined);
  const maybeStartGuestCallRef = useRef<() => void>(() => undefined);
  // join() her çağrıda kendi zamanlayıcılarını kurar; close() önce bunları
  // söker. Misafir yeniden bağlanma planlayıcısı da bağlantı olaylarından
  // erişilebilsin diye ref'te tutulur.
  const sessionCleanupRef = useRef<(() => void) | null>(null);
  const scheduleGuestRetryRef = useRef<((delay?: number) => void) | null>(null);
  const hostIdRetriesRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  const onDeliveredRef = useRef(onDelivered);
  const onRemoteLanguageRef = useRef(onRemoteLanguage);
  const localLanguageRef = useRef<RoomLanguage | null>(null);
  const outboundRef = useRef<RoomMessage[]>([]);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const remoteSpeakingTimerRef = useRef<number | null>(null);
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
    if (connectionRef.current?.open) {
      // Sıra bildirimini de kapat: yoksa karşı taraf bizi hâlâ konuşuyor
      // sanıp kendi tanıyıcısını gereksiz yere sağır tutar.
      connectionRef.current.send({ kind: "speaking", on: false } satisfies Envelope);
      connectionRef.current.send({ kind: "voice-ready", ready: false } satisfies Envelope);
    }
    closeMediaConnection();
    for (const track of localStreamRef.current?.getTracks() ?? []) track.stop();
    localStreamRef.current = null;
    setVoiceEnabled(false);
    setVoiceError("");
  }, [closeMediaConnection]);

  const clearRemoteSpeaking = useCallback(() => {
    if (remoteSpeakingTimerRef.current !== null) window.clearTimeout(remoteSpeakingTimerRef.current);
    remoteSpeakingTimerRef.current = null;
    setRemoteSpeaking(false);
  }, []);

  const close = useCallback(() => {
    sessionCleanupRef.current?.();
    sessionCleanupRef.current = null;
    scheduleGuestRetryRef.current = null;
    roleRef.current = null;
    hostIdRef.current = "";
    remoteVoiceReadyRef.current = false;
    setRemoteVoiceReady(false);
    disableVoice();
    connectionRef.current?.close();
    peerRef.current?.destroy();
    connectionRef.current = null;
    peerRef.current = null;
    clearVoiceReconnectTimer();
    clearRemoteSpeaking();
    setConnected(false);
    setConnecting(false);
  }, [clearRemoteSpeaking, clearVoiceReconnectTimer, disableVoice]);

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
    // Oda iki kişiliktir. Açık bir bağlantı varken gelen ikinci istek
    // reddedilir; yoksa üçüncü bir sekme odayı sessizce ele geçirip ilk
    // misafirin mesajlarını görünmez kılıyordu.
    const current = connectionRef.current;
    if (current && current !== connection && current.open) {
      connection.close();
      return;
    }
    if (current && current !== connection) current.close();
    connectionRef.current = connection;
    connection.on("open", () => {
      if (connectionRef.current !== connection) return;
      setConnected(true);
      setConnecting(false);
      setError("");
      for (const message of outboundRef.current) connection.send({ kind: "message", message } satisfies Envelope);
      connection.send({ kind: "voice-ready", ready: Boolean(localStreamRef.current) } satisfies Envelope);
      if (localLanguageRef.current) connection.send({ kind: "language", language: localLanguageRef.current, protocol: 2 } satisfies Envelope);
      maybeStartGuestCall();
    });
    connection.on("data", (data) => {
      // Yerini yeni bir bağlantıya bırakmış eski kanaldan gelen paketler
      // güncel sohbete karışmasın.
      if (connectionRef.current !== connection) return;
      const envelope = data as Envelope;
      if (envelope.kind === "ack") {
        outboundRef.current = outboundRef.current.filter((message) => message.id !== envelope.id);
        onDeliveredRef.current?.(envelope.id);
        return;
      }
      if (envelope.kind === "voice-ready") {
        remoteVoiceReadyRef.current = envelope.ready;
        setRemoteVoiceReady(envelope.ready);
        if (envelope.ready) {
          maybeStartGuestCall();
        } else {
          closeMediaConnection();
          // Karşı taraf sesi kapattıysa yankı riski kalmadı; mikrofonumuzu
          // sağır bırakan "konuşuyor" işareti de düşsün.
          clearRemoteSpeaking();
        }
        return;
      }
      if (envelope.kind === "speaking") {
        if (remoteSpeakingTimerRef.current !== null) window.clearTimeout(remoteSpeakingTimerRef.current);
        remoteSpeakingTimerRef.current = null;
        if (envelope.on) {
          setRemoteSpeaking(true);
          // Sinyal kaybolursa mikrofon sonsuza kadar kapalı kalmasın.
          remoteSpeakingTimerRef.current = window.setTimeout(() => setRemoteSpeaking(false), 6000);
        } else {
          // Konuşma bittikten sonra hoparlörden gelen kuyruk da geçsin diye
          // kısa bir kuyruk payı bırakıyoruz.
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
      // İlk sürümde mesajlar zarf kullanılmadan gönderiliyordu. Açık kalmış eski
      // sekmelerle görüşme devam edebilsin; yalnızca eksiksiz paketleri kabul et.
      if (isRoomMessage(data)) {
        onMessageRef.current(data);
        if (connection.open) connection.send({ kind: "ack", id: data.id } satisfies Envelope);
      }
    });
    connection.on("close", () => {
      if (connectionRef.current !== connection) return;
      setConnected(false);
      clearRemoteSpeaking();
      // Misafir kendini toparlar; ev sahibi misafirin geri gelmesini bekler.
      if (roleRef.current === "guest" && scheduleGuestRetryRef.current) {
        setConnecting(true);
        scheduleGuestRetryRef.current();
      }
    });
    connection.on("error", () => {
      if (connectionRef.current !== connection) return;
      setConnected(false);
      clearRemoteSpeaking();
      if (roleRef.current === "guest" && scheduleGuestRetryRef.current) {
        setConnecting(true);
        setError("");
        scheduleGuestRetryRef.current();
        return;
      }
      setError("Karşı tarafla bağlantı kesildi. Bağlantıyı yeniden açın.");
    });
  }, [clearRemoteSpeaking, closeMediaConnection, maybeStartGuestCall]);

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
    // Test altyapısı: E2E koşumları gerçek PeerJS bulutuna çıkamaz; localStorage
    // üzerinden yerel bir sinyal sunucusu tanımlanabilir. Üretimde bu anahtar
    // hiç yazılmadığı için davranış birebir aynı kalır.
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

    // Bu join oturumuna özel durum: close() çağrılınca disposed olur ve
    // bekleyen bütün zamanlayıcılar sökülür (yeni join eskisinin denemelerini
    // devralmaz — dünkü kopukluk sorunlarının bir kaynağı buydu).
    let disposed = false;
    let guestAttempts = 0;
    let signalRetries = 0;
    let retryTimer: number | null = null;
    let signalTimer: number | null = null;
    let connectTimeoutTimer: number | null = null;
    sessionCleanupRef.current = () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (signalTimer !== null) window.clearTimeout(signalTimer);
      if (connectTimeoutTimer !== null) window.clearTimeout(connectTimeoutTimer);
      retryTimer = null;
      signalTimer = null;
      connectTimeoutTimer = null;
    };

    const scheduleGuestRetry = (delay?: number) => {
      if (disposed || peer.destroyed || roleRef.current !== "guest" || connectionRef.current?.open) return;
      if (retryTimer !== null) return; // zaten planlanmış bir deneme var
      setConnecting(true);
      const wait = delay ?? Math.min(900 + guestAttempts * 700, 6000);
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        connectGuest();
      }, wait);
    };
    scheduleGuestRetryRef.current = scheduleGuestRetry;

    const connectGuest = () => {
      if (disposed || peer.destroyed || !peer.open || connectionRef.current?.open) return;
      guestAttempts += 1;
      setConnecting(true);
      const stale = connectionRef.current;
      const connection = peer.connect(hostId, { reliable: true });
      // connectionRef artık yeni bağlantıyı gösterir; eskinin close/error
      // olayları bindConnection'daki kimlik kontrolüne takılıp yok sayılır.
      bindConnection(connection);
      if (stale && stale !== connection && !stale.open) stale.close();
      if (connectTimeoutTimer !== null) window.clearTimeout(connectTimeoutTimer);
      connectTimeoutTimer = window.setTimeout(() => {
        connectTimeoutTimer = null;
        if (disposed || connection.open || connectionRef.current !== connection) return;
        // Sinyal gitti ama el sıkışma tamamlanmadı: bırak, yeniden dene.
        connection.close();
        scheduleGuestRetry();
      }, 7000);
      connection.on("open", () => {
        guestAttempts = 0;
        if (connectTimeoutTimer !== null) window.clearTimeout(connectTimeoutTimer);
        connectTimeoutTimer = null;
      });
    };

    peer.on("open", () => {
      hostIdRetriesRef.current = 0;
      signalRetries = 0;
      // Sinyal sunucusuna yeniden bağlanmak da 'open' üretir; P2P kanalı
      // hâlâ açıksa ikinci bir DataConnection kurup odayı bölmeyelim.
      if (role === "guest" && !connectionRef.current?.open) connectGuest();
    });
    peer.on("disconnected", () => {
      if (disposed) return;
      setConnecting(true);
      // Cihaz çevrim dışıyken gecikmesiz reconnect sıkı döngü kuruyordu.
      signalRetries += 1;
      if (signalTimer !== null) return;
      signalTimer = window.setTimeout(() => {
        signalTimer = null;
        if (disposed || peer.destroyed || peer.open) return;
        peer.reconnect();
      }, Math.min(400 * signalRetries, 5000));
    });
    peer.on("connection", bindConnection);
    peer.on("call", handleIncomingMediaConnection);
    peer.on("error", (peerError) => {
      if (disposed) return;
      const guestWaitingForHost = roleRef.current === "guest" && !connectionRef.current?.open;
      if (peerError.type === "peer-unavailable" && guestWaitingForHost) {
        // Ev sahibi henüz çevrim içi değil (ya da sayfasını yeniliyor):
        // sessizce yeniden dene; kullanıcıya ancak denemeler uzarsa bilgi ver.
        setConnected(false);
        setConnecting(true);
        setError(guestAttempts >= 8 ? "Odayı oluşturan kişi henüz çevrim içi değil. Bağlantı denemeleri sürüyor…" : "");
        scheduleGuestRetry(1100);
        return;
      }
      if (peerError.type === "webrtc" && guestWaitingForHost) {
        setConnected(false);
        setConnecting(true);
        scheduleGuestRetry(1300);
        return;
      }
      if (peerError.type === "unavailable-id" && roleRef.current === "host") {
        // Sayfa yenilendiğinde eski oturum sinyal sunucusunda birkaç saniye
        // daha kayıtlı kalabilir; kimlik serbest kalınca oda yeniden kurulur.
        hostIdRetriesRef.current += 1;
        if (hostIdRetriesRef.current <= 12) {
          setConnecting(true);
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            if (!disposed) join(room, role);
          }, 1600);
          return;
        }
        setConnecting(false);
        setConnected(false);
        setError("Oda şu anda başka bir sekmede açık görünüyor. Diğer sekmeyi kapatıp tekrar deneyin.");
        return;
      }
      if (peerError.type === "webrtc"
        || (peerError.type === "peer-unavailable" && Boolean(connectionRef.current?.open))) {
        setVoiceConnecting(false);
        setVoiceError("Canlı ses bağlantısı kurulamadı. İki tarafın da ses bağlantısını açtığından emin olun.");
        return;
      }
      if (peerError.type === "network") {
        // Sinyal sunucusuna anlık erişilemedi; 'disconnected' akışı
        // peer.reconnect() ile zaten toparlamayı dener.
        setConnecting(true);
        return;
      }
      setConnecting(false);
      setConnected(false);
      setError("Oda bağlantısı kurulamadı. İnternet bağlantınızı kontrol edin.");
    });
  }, [bindConnection, close, handleIncomingMediaConnection]);

  const send = useCallback((message: RoomMessage) => {
    // Aynı kimlikle gelen güncellenmiş mesaj bekleme listesindeki eski
    // kopyanın yerine geçer; yeniden bağlanınca güncel hali gönderilir.
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
    if (!connectionRef.current?.open) return false;
    connectionRef.current.send({ kind: "speaking", on } satisfies Envelope);
    return true;
  }, []);

  // Çeviri seslendirilirken kendi mikrofonumuzun canlı yayınını susturuyoruz;
  // yoksa karşı taraf kendi cümlesinin çevirisini hoparlörümüzden geri duyar.
  const setVoiceTransmitting = useCallback((on: boolean) => {
    const stream = localStreamRef.current;
    if (!stream) return false;
    for (const track of stream.getAudioTracks()) track.enabled = on;
    return true;
  }, []);

  return {
    remoteSpeaking,
    sendSpeaking,
    setVoiceTransmitting,
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
