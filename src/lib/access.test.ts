import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FREE_TRIAL_MS, formatRemaining, readTrialUsed, useAccess } from "./access";

describe("erişim ve deneme süresi", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("ücretsiz deneme 5 dakikadır", () => {
    expect(FREE_TRIAL_MS).toBe(300_000);
    expect(formatRemaining(FREE_TRIAL_MS)).toBe("5:00");
  });

  it("konuşma başlamadan süre işlemez", () => {
    const { result } = renderHook(() => useAccess({ uid: "u1", plan: "free", active: false, ready: true }));
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(result.current.remaining).toBe(FREE_TRIAL_MS);
    expect(readTrialUsed("u1")).toBe(0);
    expect(result.current.state).toBe("trial");
  });

  it("konuşma başlayınca süre işler ve kalıcı olarak yazılır", () => {
    const { result } = renderHook(() => useAccess({ uid: "u2", plan: "free", active: true, ready: true }));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.remaining).toBeLessThan(FREE_TRIAL_MS);
    expect(readTrialUsed("u2")).toBeGreaterThan(0);
  });

  it("abonenin sayacı hiç işlemez", () => {
    const { result } = renderHook(() => useAccess({ uid: "u3", plan: "pro", active: true, ready: true }));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.state).toBe("subscribed");
    expect(readTrialUsed("u3")).toBe(0);
  });

  it("hak bittiğinde durum expired olur", () => {
    localStorage.setItem("dilmac-trial-used:u4", String(FREE_TRIAL_MS));
    const { result } = renderHook(() => useAccess({ uid: "u4", plan: "free", active: false, ready: true }));
    expect(result.current.state).toBe("expired");
    expect(result.current.remaining).toBe(0);
  });

  it("giriş yapılmamışsa durum anonymous olur", () => {
    const { result } = renderHook(() => useAccess({ uid: null, plan: "free", active: true, ready: true }));
    expect(result.current.state).toBe("anonymous");
  });
});
