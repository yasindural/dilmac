import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { DataConnection } from "peerjs";

export type RoomMessage = {
  id: string;
  source: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  sentAt: number;
};

type Role = "host" | "guest";
type Envelope = { kind: "message"; message: RoomMessage } | { kind: "ack"; id: string };

export function useRoom(onMessage: (message: RoomMessage) => void, onDelivered?: (id: string) => void) {
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const onMessageRef = useRef(onMessage);
  const onDeliveredRef = useRef(onDelivered);
  const outboundRef = useRef<RoomMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onDeliveredRef.current = onDelivered; }, [onDelivered]);

  const close = useCallback(() => {
    connectionRef.current?.close();
    peerRef.current?.destroy();
    connectionRef.current = null;
    peerRef.current = null;
    setConnected(false);
    setConnecting(false);
  }, []);

  useEffect(() => close, [close]);

  const bindConnection = useCallback((connection: DataConnection) => {
    connectionRef.current = connection;
    connection.on("open", () => {
      setConnected(true);
      setConnecting(false);
      setError("");
      for (const message of outboundRef.current) connection.send({ kind: "message", message } satisfies Envelope);
    });
    connection.on("data", (data) => {
      const envelope = data as Envelope;
      if (envelope.kind === "ack") {
        outboundRef.current = outboundRef.current.filter((message) => message.id !== envelope.id);
        onDeliveredRef.current?.(envelope.id);
        return;
      }
      if (envelope.kind === "message") {
        onMessageRef.current(envelope.message);
        connection.send({ kind: "ack", id: envelope.message.id } satisfies Envelope);
      }
    });
    connection.on("close", () => setConnected(false));
    connection.on("error", () => {
      setError("Karşı tarafla bağlantı kesildi. Bağlantıyı yeniden açın.");
      setConnected(false);
    });
  }, []);

  const join = useCallback((room: string, role: Role) => {
    close();
    setConnecting(true);
    setError("");
    const hostId = `dilmac-${room.toLowerCase()}-host`;
    const peer = role === "host"
      ? new Peer(hostId, { debug: 1 })
      : new Peer({ debug: 1 });
    peerRef.current = peer;
    let reconnectAttempts = 0;
    const connectGuest = () => {
      if (peer.destroyed || reconnectAttempts >= 5) return;
      const connection = peer.connect(hostId, { reliable: true });
      bindConnection(connection);
      connection.on("open", () => { reconnectAttempts = 0; });
      connection.on("close", () => {
        reconnectAttempts += 1;
        setConnecting(true);
        window.setTimeout(connectGuest, Math.min(1000 * 2 ** reconnectAttempts, 8000));
      });
    };
    peer.on("open", () => {
      if (role === "guest") connectGuest();
    });
    peer.on("disconnected", () => {
      setConnecting(true);
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on("connection", bindConnection);
    peer.on("error", (peerError) => {
      setConnecting(false);
      setConnected(false);
      setError(peerError.type === "peer-unavailable"
        ? "Odayı oluşturan kişi henüz çevrim içi değil. Birkaç saniye sonra tekrar deneyin."
        : "Oda bağlantısı kurulamadı. İnternet bağlantınızı kontrol edin.");
    });
  }, [bindConnection, close]);

  const send = useCallback((message: RoomMessage) => {
    if (!outboundRef.current.some((candidate) => candidate.id === message.id)) outboundRef.current.push(message);
    if (!connectionRef.current?.open) return false;
    connectionRef.current.send({ kind: "message", message } satisfies Envelope);
    return true;
  }, []);

  return { connected, connecting, error, join, send, close };
}
