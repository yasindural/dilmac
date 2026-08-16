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
    // Gerçek MediaStreamTrack gibi: enabled=false yayını susturur.
    enabled: true,
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

  afterEach(() => cleanup());

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

  // Canlı ses açıkken iki cihaz birbirini hoparlörden duyar; konuşan tarafın
  // sesi diğerinin mikrofonuna girip uydurma cümleler üretiyordu. Sıra
  // bildirimi bunu engelleyen mekanizma.
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

    // Konuşma bitince kuyruk payı kadar bekleyip serbest bırakır.
    act(() => dataConnection.emit("data", { kind: "speaking", on: false }));
    expect(result.current.remoteSpeaking).toBe(true);
    await waitFor(() => expect(result.current.remoteSpeaking).toBe(false), { timeout: 2000 });
  });

  it("ev sahibi henüz yokken misafir pes etmez, tekrar tekrar dener", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRoom(vi.fn()));
      act(() => result.current.join("ABC123", "guest"));
      const peer = peerMocks.peers.at(-1)!;
      peer.open = true;
      act(() => peer.emit("open", "guest-peer"));
      expect(peer.connect).toHaveBeenCalledTimes(1);

      // PeerJS 'peer-unavailable' üretir ve bağlantıyı hiç açmaz; eskiden
      // burada tek bir deneme yapılıp kullanıcı sonsuza dek beklerdi.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        act(() => peer.emit("error", { type: "peer-unavailable" }));
        act(() => { vi.advanceTimersByTime(7000); });
      }
      expect(peer.connect.mock.calls.length).toBeGreaterThan(3);
      expect(result.current.connecting).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("oda iki kişiliktir: açık bağlantı varken gelen üçüncü istek reddedilir", () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useRoom(onMessage));
    act(() => result.current.join("ABC123", "host"));
    const { dataConnection } = connectHost();

    const intruder = new peerMocks.FakeDataConnection();
    const peer = peerMocks.peers.at(-1)!;
    act(() => peer.emit("connection", intruder));
    expect(intruder.close).toHaveBeenCalled();

    // İlk misafirin mesajları işlenmeye devam eder.
    act(() => dataConnection.emit("data", {
      kind: "message",
      message: { id: "m1", source: "merhaba", translated: "hello", sourceLanguage: "Türkçe", targetLanguage: "İngilizce", sentAt: 1 },
      protocol: 2,
    }));
    expect(onMessage).toHaveBeenCalledTimes(1);

    // Reddedilen bağlantıdan gelen paket sohbete karışmaz.
    act(() => intruder.emit("data", {
      kind: "message",
      message: { id: "m2", source: "araya girdim", translated: "i cut in", sourceLanguage: "Türkçe", targetLanguage: "İngilizce", sentAt: 2 },
      protocol: 2,
    }));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("seslendirme sırasında giden mikrofon yayını susturulur ve geri açılır", async () => {
    const { stream, track } = createStream();
    peerMocks.getUserMedia.mockResolvedValue(stream);
    const { result } = renderHook(() => useRoom(vi.fn()));
    act(() => result.current.join("ABC123", "host"));
    connectHost();
    await act(async () => { await result.current.enableVoice(); });

    act(() => { result.current.setVoiceTransmitting(false); });
    expect(track.enabled).toBe(false);
    act(() => { result.current.setVoiceTransmitting(true); });
    expect(track.enabled).toBe(true);
  });

  it("canlı ses kapatılırken karşı tarafa 'konuşmuyorum' bildirilir", async () => {
    const { stream } = createStream();
    peerMocks.getUserMedia.mockResolvedValue(stream);
    const { result } = renderHook(() => useRoom(vi.fn()));
    act(() => result.current.join("ABC123", "host"));
    const { dataConnection } = connectHost();
    await act(async () => { await result.current.enableVoice(); });
    dataConnection.send.mockClear();

    act(() => result.current.disableVoice());
    expect(dataConnection.send).toHaveBeenCalledWith({ kind: "speaking", on: false });
    expect(dataConnection.send).toHaveBeenCalledWith({ kind: "voice-ready", ready: false });
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
});
