import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "./translation";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("çeviri", () => {
  it("Türkçe demo örneğini İngilizceye çevirir", async () => {
    const result = await translate("Merhaba, nasılsın?", "İngilizce");
    expect(result.demo).toBe(true);
    expect(result.text).toBe("Hello");
  });

  it("takılan canlı isteği 21 saniye sonra durdurur", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_DILMAC_API_URL", "https://api.example.test");
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));

    const request = translate("Merhaba", "İngilizce");
    const assertion = expect(request).rejects.toThrow("Çeviri yanıtı gecikti");
    await vi.advanceTimersByTimeAsync(21_000);
    await assertion;
  });
});
