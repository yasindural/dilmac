import { describe, expect, it, vi } from "vitest";
import { MessageQueue } from "./messageQueue";

const waitUntil = async (test: () => boolean) => { for (let i = 0; i < 100 && !test(); i++) await new Promise((resolve) => setTimeout(resolve, 5)); };
const draft = (source: string) => ({ source, sourceLanguage: "Türkçe", targetLanguage: "İngilizce" });

describe("MessageQueue", () => {
  it("10 gecikmeli mesajı FIFO sırasıyla kaybetmeden işler", async () => {
    const sent: string[] = [];
    const queue = new MessageQueue(async (text) => { await new Promise((resolve) => setTimeout(resolve, 8)); return { text: `T:${text}`, demo: false }; }, (message) => { sent.push(message.source); return true; });
    for (let index = 1; index <= 10; index++) queue.enqueue(draft(`mesaj-${index}`));
    await waitUntil(() => sent.length === 10);
    expect(sent).toEqual(Array.from({ length: 10 }, (_, index) => `mesaj-${index + 1}`));
  });

  it("hatalı mesajı kaybetmez ve retry sonrası devam eder", async () => {
    let fail = true; const sent: string[] = [];
    const queue = new MessageQueue(async (text) => { if (text === "iki" && fail) throw new Error("geçici hata"); return { text, demo: false }; }, (message) => { sent.push(message.source); return true; });
    queue.enqueue(draft("bir")); const failedId = queue.enqueue(draft("iki")); queue.enqueue(draft("üç"));
    await waitUntil(() => queue.snapshot().some((item) => item.status === "failed"));
    expect(sent).toEqual(["bir", "üç"]);
    fail = false; queue.retry(failedId); await waitUntil(() => sent.length === 3);
    expect(sent).toEqual(["bir", "üç", "iki"]);
  });

  it("uzun metni kesmeden gönderir", async () => {
    const long = "a".repeat(3000); const delivered: string[] = []; const sender = vi.fn((message: { translated: string }) => { delivered.push(message.translated); return true; });
    const queue = new MessageQueue(async (text) => ({ text, demo: false }), sender);
    queue.enqueue(draft(long)); await waitUntil(() => sender.mock.calls.length === 1);
    expect(delivered[0]).toHaveLength(3000);
  });

  it("iki kullanıcının 10'ar mesajlık sırasını birbirinden bağımsız korur", async () => {
    const left: string[] = []; const right: string[] = [];
    const translator = async (text: string) => { await new Promise((resolve) => setTimeout(resolve, Math.random() * 5)); return { text, demo: false }; };
    const leftQueue = new MessageQueue(translator, (message) => { left.push(message.source); return true; });
    const rightQueue = new MessageQueue(translator, (message) => { right.push(message.source); return true; });
    for (let index = 1; index <= 10; index++) { leftQueue.enqueue(draft(`sol-${index}`)); rightQueue.enqueue(draft(`sağ-${index}`)); }
    await waitUntil(() => left.length + right.length === 20);
    expect(left).toEqual(Array.from({ length: 10 }, (_, index) => `sol-${index + 1}`));
    expect(right).toEqual(Array.from({ length: 10 }, (_, index) => `sağ-${index + 1}`));
  });

  it("kaynak ve hedef dil aynıysa çeviri servisine hiç gitmez", async () => {
    const translator = vi.fn();
    const sent: unknown[] = [];
    const queue = new MessageQueue(translator as never, (message) => { sent.push(message); return true; });
    queue.enqueue({ source: "Merhaba", sourceLanguage: "Türkçe", targetLanguage: "Türkçe" });
    await vi.waitFor(() => expect(sent.length).toBe(1));
    expect(translator).not.toHaveBeenCalled();
    expect(queue.snapshot()[0]).toMatchObject({ translated: "Merhaba", status: "sent" });
  });
});
