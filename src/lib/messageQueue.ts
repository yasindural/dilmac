import type { RoomMessage } from "../hooks/useRoom";
import type { TranslationResult } from "./translation";

export type MessageStatus = "queued" | "translating" | "sent" | "delivered" | "failed";
export type QueueItem = RoomMessage & { sequence: number; status: MessageStatus; error?: string };
type Draft = Pick<RoomMessage, "source" | "sourceLanguage" | "targetLanguage">;
type Translator = (text: string, target: string) => Promise<TranslationResult>;
type Sender = (message: RoomMessage) => boolean;

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

  enqueue(draft: Draft) {
    const item: QueueItem = { ...draft, id: crypto.randomUUID(), translated: "", sentAt: Date.now(), sequence: ++this.sequence, status: "queued" };
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
        const item = this.items.find((candidate) => candidate.status === "queued");
        if (!item) break;
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

  private toRoomMessage(item: QueueItem): RoomMessage {
    const { id, source, translated, sourceLanguage, targetLanguage, sentAt } = item;
    return { id, source, translated, sourceLanguage, targetLanguage, sentAt };
  }

  private emit() { const snapshot = this.snapshot(); this.listeners.forEach((listener) => listener(snapshot)); }
}
