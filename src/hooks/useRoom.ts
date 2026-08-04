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

export function useRoom(onMessage: (message: RoomMessage) => void) {
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const onMessageRef = useRef(onMessage);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

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
    });
    connection.on("data", (data) => onMessageRef.current(data as RoomMessage));
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
    peer.on("open", () => {
      if (role === "guest") bindConnection(peer.connect(hostId, { reliable: true }));
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
    if (!connectionRef.current?.open) return false;
    connectionRef.current.send(message);
    return true;
  }, []);

  return { connected, connecting, error, join, send, close };
}
