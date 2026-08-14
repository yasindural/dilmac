import type { RoomMessage } from "../hooks/useRoom";
import type { TranslationResult } from "./translation";

export type MessageStatus = "queued" | "translating" | "sent" | "delivered" | "failed";
export type QueueItem = RoomMessage & { sequence: number; status: MessageStatus; error?: string; lastActivityAt: number; pendingSegments: string[] };
type Draft = Pick<RoomMessage, "source" | "sourceLanguage" | "targetLanguage">;
type Translator = (text: string, target: string) => Promise<TranslationResult>;
type Sender = (message: RoomMessage) => boolean;
// Konuşmacı kısa bir duraksamadan sonra devam ederse yeni baloncuk açmak
// yerine son mesaj düzenlenir: kaynak metin uzar, yalnızca yeni parça
// çevrilir ve mesaj aynı kimlikle yeniden gönderilir. lastRemoteAt, araya
// karşı tarafın cümlesi girdiyse birleştirmeyi kapatır — sohbet sırası bozulmaz.
export type EnqueueOptions = { mergeWindowMs?: number; lastRemoteAt?: number };

export class MessageQueue {
  private items: QueueItem[] = [];
  private sequence = 0;
  private processing = false;
  private listeners = new Set<(items: QueueItem[]) => void>();

  constructor(private translator: Translator, private sender: Sender) {}

  subscribe(listener: (items: QueueItem[]) => void) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => { this.listeners.delete(listener); };
  }

  enqueue(draft: Draft, options?: EnqueueOptions) {
    const now = Date.now();
    const last = this.items[this.items.length - 1];
    const mergeWindow = options?.mergeWindowMs ?? 0;
    const canMerge = Boolean(last)
      && mergeWindow > 0
      && last.status !== "failed"
      && last.sourceLanguage === draft.sourceLanguage
      && last.targetLanguage === draft.targetLanguage
      && now - last.lastActivityAt <= mergeWindow
      && last.lastActivityAt > (options?.lastRemoteAt ?? 0);
    if (canMerge) {
      last.source = `${last.source} ${draft.source}`.trim();
      last.lastActivityAt = now;
      // Henüz çevrilmediyse tek istek hepsini kapsar; çevrildiyse yalnızca
      // yeni parça çevrilip sona eklenir.
      if (last.status !== "queued") {
        last.pendingSegments.push(draft.source);
        if (last.status === "sent" || last.status === "delivered") last.status = "translating";
      }
      this.emit();
      void this.drain();
      return last.id;
    }
    const item: QueueItem = { ...draft, id: crypto.randomUUID(), translated: "", sentAt: now, sequence: ++this.sequence, status: "queued", lastActivityAt: now, pendingSegments: [] };
    this.items.push(item);
    this.emit();
    void this.drain();
    return item.id;
  }

  retry(id: string) {
    const item = this.items.find((candidate) => candidate.id === id && candidate.status === "failed");
    if (!item) return;
    item.status = "queued";
    item.error = undefined;
    this.emit();
    void this.drain();
  }

  markDelivered(id: string) {
    const item = this.items.find((candidate) => candidate.id === id);
    if (item && item.status === "sent") { item.status = "delivered"; this.emit(); }
  }

  resendPending() {
    for (const item of this.items) {
      if (item.status === "sent" && item.translated) this.sender(this.toRoomMessage(item));
    }
  }

  snapshot() { return this.items.map((item) => ({ ...item })); }

  private async drain() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (true) {
        const item = this.items.find((candidate) => candidate.status === "queued" || candidate.pendingSegments.length > 0);
        if (!item) break;
        const sameLanguage = item.sourceLanguage.trim().toLocaleLowerCase("tr") === item.targetLanguage.trim().toLocaleLowerCase("tr");
        // Gönderilmiş mesaja eklenen parça: yalnızca yeni parça çevrilir,
        // mesaj aynı kimlikle (appended ile) yeniden gönderilir.
        if (item.status !== "queued") {
          const segmentText = item.pendingSegments.join(" ").trim();
          item.pendingSegments = [];
          if (!segmentText) { this.emit(); continue; }
          if (sameLanguage) {
            item.translated = item.source;
            item.status = "sent";
            this.sender(this.toRoomMessage(item, segmentText));
            this.emit();
            continue;
          }
          item.status = "translating";
          this.emit();
          try {
            const result = await this.translator(segmentText, item.targetLanguage);
            item.translated = `${item.translated} ${result.text}`.trim();
            item.status = "sent";
            this.sender(this.toRoomMessage(item, result.text));
          } catch (error) {
            item.status = "failed";
            item.error = error instanceof Error ? error.message : "Çeviri başarısız oldu.";
          }
          this.emit();
          continue;
        }
        // Kuyruğa alınmış tam mesaj: kaynak, bekleyen parçaları zaten içerir.
        item.pendingSegments = [];
        // Kaynak ve hedef dil aynıysa çeviri istemek hem gereksiz gecikme hem
        // gereksiz maliyet; model "Türkçeyi Türkçeye çevir" isteğine takılıyordu.
        if (sameLanguage) {
          item.translated = item.source;
          item.status = "sent";
          this.sender(this.toRoomMessage(item));
          this.emit();
          continue;
        }
        item.status = "translating";
        this.emit();
        try {
          const result = await this.translator(item.source, item.targetLanguage);
          item.translated = result.text;
          item.status = "sent";
          this.sender(this.toRoomMessage(item));
        } catch (error) {
          item.status = "failed";
          item.error = error instanceof Error ? error.message : "Çeviri başarısız oldu.";
        }
        this.emit();
      }
    } finally { this.processing = false; }
  }

  private toRoomMessage(item: QueueItem, appended?: string): RoomMessage {
    const { id, source, translated, sourceLanguage, targetLanguage, sentAt } = item;
    return appended
      ? { id, source, translated, sourceLanguage, targetLanguage, sentAt, appended }
      : { id, source, translated, sourceLanguage, targetLanguage, sentAt };
  }

  private emit() { const snapshot = this.snapshot(); this.listeners.forEach((listener) => listener(snapshot)); }
}
