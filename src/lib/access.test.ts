import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FREE_TRIAL_MS, TRIAL_ENABLED, formatRemaining, readTrialUsed, useAccess } from "./access";

describe("erişim ve deneme süresi", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("ücretsiz deneme üç dakikadır ve açıktır", () => {
    expect(FREE_TRIAL_MS).toBe(180_000);
    expect(formatRemaining(FREE_TRIAL_MS)).toBe("3:00");
    expect(TRIAL_ENABLED).toBe(true);
  });

  it("konuşma başlamadan süre işlemez", () => {
    const { result } = renderHook(() => useAccess({ uid: "u1", plan: "free", feature: "live", active: false, ready: true }));
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(result.current.remaining).toBe(FREE_TRIAL_MS);
    expect(readTrialUsed("u1")).toBe(0);
    expect(result.current.state).toBe("trial");
  });

  it("konuşma başlayınca süre işler ve kalıcı olarak yazılır", () => {
    const { result } = renderHook(() => useAccess({ uid: "u2", plan: "free", feature: "live", active: true, ready: true }));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.remaining).toBeLessThan(FREE_TRIAL_MS);
    expect(readTrialUsed("u2")).toBeGreaterThan(0);
  });

  it("AI ve canlı oda haklarını ayrı tutar", () => {
    const { result } = renderHook(() => useAccess({ uid: "u-ayri", plan: "free", feature: "ai", active: true, ready: true }));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.used).toBeGreaterThan(0);
    expect(readTrialUsed("u-ayri", "ai")).toBeGreaterThan(0);
    expect(readTrialUsed("u-ayri", "live")).toBe(0);
  });

  it("abonenin sayacı hiç işlemez", () => {
    const { result } = renderHook(() => useAccess({ uid: "u3", plan: "pro", feature: "live", active: true, ready: true }));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.state).toBe("subscribed");
    expect(readTrialUsed("u3")).toBe(0);
  });

  it("hak bittiğinde durum expired olur", () => {
    localStorage.setItem("dilmac-trial-used:u4:live", String(FREE_TRIAL_MS));
    const { result } = renderHook(() => useAccess({ uid: "u4", plan: "free", feature: "live", active: false, ready: true }));
    expect(result.current.state).toBe("expired");
    expect(result.current.remaining).toBe(0);
  });

  it("giriş yapılmamışsa durum anonymous olur", () => {
    const { result } = renderHook(() => useAccess({ uid: null, plan: "free", feature: "live", active: true, ready: true }));
    expect(result.current.state).toBe("anonymous");
  });
});
