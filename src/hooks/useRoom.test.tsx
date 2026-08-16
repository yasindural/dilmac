import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const peerMocks = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;

  class FakeEmitter {
    private listeners = new Map<string, Listener[]>();

    on(event: string, listener: Listener) {
      const listeners = this.listeners.get(event) ?? [];
      listeners.push(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      for (const listener of this.listeners.get(event) ?? []) listener(...args);
    }
  }

  class FakeDataConnection extends FakeEmitter {
    open = false;
    send = vi.fn();
    close = vi.fn(() => {
      this.open = false;
    });
  }

  class FakeMediaConnection extends FakeEmitter {
    answer = vi.fn();
    close = vi.fn();
  }

  const peers: FakePeer[] = [];

  class FakePeer extends FakeEmitter {
    open = false;
    destroyed = false;
    dataConnections: FakeDataConnection[] = [];
    mediaConnections: FakeMediaConnection[] = [];
    connect = vi.fn(() => {
      const connection = new FakeDataConnection();
      this.dataConnections.push(connection);
      return connection;
    });
    call = vi.fn(() => {
      const connection = new FakeMediaConnection();
      this.mediaConnections.push(connection);
      return connection;
    });
    reconnect = vi.fn();
    destroy = vi.fn(() => {
      this.destroyed = true;
      this.open = false;
    });

    constructor() {
      super();
      peers.push(this);
    }
  }

  return {
    FakeDataConnection,
    FakeMediaConnection,
    FakePeer,
    getUserMedia: vi.fn(),
    peers,
  };
});

vi.mock("peerjs", () => ({
  default: peerMocks.FakePeer,
  DataConnection: peerMocks.FakeDataConnection,
  MediaConnection: peerMocks.FakeMediaConnection,
}));

import { useRoom } from "./useRoom";

function createStream() {
  const track = {
    addEventListener: vi.fn(),
    stop: vi.fn(),
  };
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track };
}

function connectHost(dataConnection = new peerMocks.FakeDataConnection()) {
  const peer = peerMocks.peers.at(-1)!;
  peer.open = true;
  act(() => {
    peer.emit("open", "dilmac-abc123-host");
    peer.emit("connection", dataConnection);
    dataConnection.open = true;
    dataConnection.emit("open");
  });
  return { dataConnection, peer };
}

function connectGuest() {
  const peer = peerMocks.peers.at(-1)!;
  peer.open = true;
  act(() => peer.emit("open", "guest-peer"));
  const dataConnection = peer.dataConnections[0];
  act(() => {
    dataConnection.open = true;
    dataConnection.emit("open");
  });
  return { dataConnection, peer };
}

describe("useRoom voice channel", () => {
  beforeEach(() => {
    peerMocks.peers.splice(0);
    peerMocks.getUserMedia.mockReset();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: peerMocks.getUserMedia },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("mikrofon izni verilince ses durumunu açar ve voice-ready gönderir", async () => {
    const { stream } = createStream();
    peerMocks.getUserMedia.mockResolvedValue(stream);
    const { result } = renderHook(() => useRoom(vi.fn()));

    act(() => result.current.join("ABC123", "host"));
    const { dataConnection } = connectHost();
    dataConnection.send.mockClear();

    let enabled = false;
    await act(async () => {
      enabled = await result.current.enableVoice();
    });

    expect(enabled).toBe(true);
    expect(peerMocks.getUserMedia).toHaveBeenCalledWith({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
    expect(result.current.voiceEnabled).toBe(true);
    expect(result.current.voiceError).toBe("");
    expect(dataConnection.send).toHaveBeenCalledWith({ kind: "voice-ready", ready: true });
  });

  it("mikrofon izni reddedilince kullanıcıya anlaşılır hata döndürür", async () => {
    peerMocks.getUserMedia.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    const { result } = renderHook(() => useRoom(vi.fn()));

    let enabled = true;
    await act(async () => {
      enabled = await result.current.enableVoice();
    });

    expect(enabled).toBe(false);
    expect(result.current.voiceEnabled).toBe(false);
    expect(result.current.voiceConnecting).toBe(false);
    expect(result.current.voiceError).toBe("Karşı tarafın sesini paylaşmak için mikrofon iznine izin verin.");
  });

  it("disableVoice mikrofon izini durdurur ve karşı tarafa kapalı durumunu gönderir", async () => {
    const { stream, track } = createStream();
    peerMocks.getUserMedia.mockResolvedValue(stream);
    const { result } = renderHook(() => useRoom(vi.fn()));

    act(() => result.current.join("ABC123", "host"));
    const { dataConnection } = connectHost();
    await act(async () => {
      await result.current.enableVoice();
    });
    dataConnection.send.mockClear();

    act(() => result.current.disableVoice());

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(result.current.voiceEnabled).toBe(false);
    expect(dataConnection.send).toHaveBeenCalledWith({ kind: "voice-ready", ready: false });
  });

  it("close aktif mikrofon izini durdurur ve Peer bağlantısını kapatır", async () => {
    const { stream, track } = createStream();
    peerMocks.getUserMedia.mockResolvedValue(stream);
    const { result } = renderHook(() => useRoom(vi.fn()));

    act(() => result.current.join("ABC123", "host"));
    const { peer } = connectHost();
    await act(async () => {
      await result.current.enableVoice();
    });

    act(() => result.current.close());

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(peer.destroy).toHaveBeenCalledTimes(1);
    expect(result.current.voiceEnabled).toBe(false);
    expect(result.current.connected).toBe(false);
  });

  it("guest iki taraf hazır olduğunda tek medya çağrısı kurar ve uzak sesi bağlı gösterir", async () => {
    const { stream: localStream } = createStream();
    const { stream: remoteStream } = createStream();
    peerMocks.getUserMedia.mockResolvedValue(localStream);
    const { result } = renderHook(() => useRoom(vi.fn()));

    act(() => result.current.join("ABC123", "guest"));
    const { dataConnection, peer } = connectGuest();
    await act(async () => {
      await result.current.enableVoice();
    });
    expect(peer.call).not.toHaveBeenCalled();

    act(() => {
      dataConnection.emit("data", { kind: "voice-ready", ready: true });
      dataConnection.emit("data", { kind: "voice-ready", ready: true });
    });

    expect(peer.call).toHaveBeenCalledTimes(1);
    expect(peer.call).toHaveBeenCalledWith("dilmac-abc123-host", localStream);
    expect(result.current.remoteVoiceReady).toBe(true);
    expect(result.current.voiceConnecting).toBe(true);

    const mediaConnection = peer.mediaConnections[0];
    act(() => mediaConnection.emit("stream", remoteStream));

    await waitFor(() => expect(result.current.voiceConnected).toBe(true));
    expect(result.current.remoteStream).toBe(remoteStream);
    expect(result.current.voiceConnecting).toBe(false);
  });

  it("dil seçimini karşı tarafa anında gönderir ve uzak dil değişimini bildirir", () => {
    const onRemoteLanguage = vi.fn();
    const { result } = renderHook(() => useRoom(vi.fn(), undefined, onRemoteLanguage));

    act(() => result.current.join("ABC123", "host"));
    const { dataConnection } = connectHost();
    dataConnection.send.mockClear();

    act(() => result.current.sendLanguage({ code: "tr-TR", name: "Türkçe" }));
    expect(dataConnection.send).toHaveBeenCalledWith({
      kind: "language",
      language: { code: "tr-TR", name: "Türkçe" },
      protocol: 2,
    });

    act(() => dataConnection.emit("data", {
      kind: "language",
      language: { code: "en-US", name: "İngilizce" },
      protocol: 2,
    }));
    expect(onRemoteLanguage).toHaveBeenCalledWith({ code: "en-US", name: "İngilizce" });
  });

  it("konuşma sinyalini karşı tarafa gönderir ve gelen sinyali durum olarak yansıtır", async () => {
    const { result } = renderHook(() => useRoom(vi.fn()));
    act(() => result.current.join("ABC123", "host"));
    const { dataConnection } = connectHost();
    dataConnection.send.mockClear();

    act(() => { result.current.sendSpeaking(true); });
    expect(dataConnection.send).toHaveBeenCalledWith({ kind: "speaking", on: true });

    expect(result.current.remoteSpeaking).toBe(false);
    act(() => dataConnection.emit("data", { kind: "speaking", on: true }));
    expect(result.current.remoteSpeaking).toBe(true);

    act(() => dataConnection.emit("data", { kind: "speaking", on: false }));
    expect(result.current.remoteSpeaking).toBe(true);
    await waitFor(() => expect(result.current.remoteSpeaking).toBe(false), { timeout: 2000 });
  });

  it("boş mesaj paketini konuşmaya eklemez", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useRoom(onMessage));

    act(() => result.current.join("ABC123", "host"));
    const { dataConnection } = connectHost();
    act(() => dataConnection.emit("data", {
      kind: "message",
      message: { id: "empty", source: "", translated: "" },
      protocol: 2,
    }));

    expect(onMessage).not.toHaveBeenCalled();
    expect(result.current.error).toContain("geçersiz veya boş");
  });

  it("host ilk denemede bulunamazsa guest otomatik tekrar bağlanır", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRoom(vi.fn()));

    act(() => result.current.join("ABC123", "guest"));
    const peer = peerMocks.peers.at(-1)!;
    peer.open = true;
    act(() => peer.emit("open", "guest-peer"));
    expect(peer.connect).toHaveBeenCalledTimes(1);

    act(() => {
      peer.emit("error", { type: "peer-unavailable" });
      vi.advanceTimersByTime(901);
    });

    expect(peer.connect).toHaveBeenCalledTimes(2);
    expect(result.current.connecting).toBe(true);
    expect(result.current.error).toBe("");
  });

  it("açılmayan guest veri bağlantısını timeout sonrası yeniler", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRoom(vi.fn()));

    act(() => result.current.join("ABC123", "guest"));
    const peer = peerMocks.peers.at(-1)!;
    peer.open = true;
    act(() => peer.emit("open", "guest-peer"));
    const first = peer.dataConnections[0];
    expect(peer.connect).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(6501);
      vi.advanceTimersByTime(1401);
    });

    expect(first.close).toHaveBeenCalled();
    expect(peer.connect).toHaveBeenCalledTimes(2);
    expect(result.current.connecting).toBe(true);
  });
});
