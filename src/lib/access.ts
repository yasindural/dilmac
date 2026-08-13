import { useCallback, useEffect, useRef, useState } from "react";

// Erişim kuralları tek yerde toplanır:
//  - Canlı çeviri yalnızca kayıtlı kullanıcılara açıktır.
//  - Abone olmayan kayıtlı kullanıcı 5 dakika GERÇEK KULLANIM hakkı alır.
//    Süre duvar saatiyle değil, gerçekten konuşulan süreyle işler: odaya
//    girmek, karşı tarafı beklemek veya sekmeyi arka plana almak süreyi
//    harcamaz. Sayaç ancak bağlantı kurulup konuşma başlayınca işler.

// Şimdilik deneme süresi KAPALI: kayıtlı herkes sınırsız kullanır.
// Tekrar açmak için tek satır: TRIAL_ENABLED = true.
export const TRIAL_ENABLED = false;
export const FREE_TRIAL_MS = 300_000;

export type PlanId = "free" | "pro" | "business";
export type AccessState = "loading" | "anonymous" | "trial" | "expired" | "subscribed";

const usageKey = (uid: string) => `dilmac-trial-used:${uid}`;

export function readTrialUsed(uid: string) {
  try {
    const raw = Number(localStorage.getItem(usageKey(uid)));
    return Number.isFinite(raw) && raw > 0 ? Math.min(raw, FREE_TRIAL_MS) : 0;
  } catch {
    return 0;
  }
}

function writeTrialUsed(uid: string, used: number) {
  try {
    localStorage.setItem(usageKey(uid), String(Math.min(Math.max(used, 0), FREE_TRIAL_MS)));
  } catch { /* depolama kapalıysa sessizce geç */ }
}

export function resetTrial(uid: string) {
  try {
    localStorage.removeItem(usageKey(uid));
  } catch { /* yoksay */ }
}

export function isSubscribed(plan: PlanId | undefined | null) {
  return plan === "pro" || plan === "business";
}

export function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type AccessInput = {
  uid: string | null;
  plan: PlanId | null;
  /** Sayaç yalnızca gerçekten konuşulurken işlesin diye dışarıdan kontrol edilir. */
  active: boolean;
  ready: boolean;
};

export function useAccess({ uid, plan, active, ready }: AccessInput) {
  const [used, setUsed] = useState(0);
  const tickRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    setUsed(uid ? readTrialUsed(uid) : 0);
  }, [uid]);

  const subscribed = isSubscribed(plan) || !TRIAL_ENABLED;
  const remaining = Math.max(0, FREE_TRIAL_MS - used);
  const countdownRunning = TRIAL_ENABLED && Boolean(uid) && !subscribed && active && remaining > 0;

  useEffect(() => {
    if (!countdownRunning || !uid) {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    lastTickRef.current = Date.now();
    tickRef.current = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setUsed((current) => {
        const next = Math.min(FREE_TRIAL_MS, current + delta);
        writeTrialUsed(uid, next);
        return next;
      });
    }, 1000);
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [countdownRunning, uid]);

  const state: AccessState = !ready
    ? "loading"
    : !uid
      ? "anonymous"
      : subscribed
        ? "subscribed"
        : remaining > 0
          ? "trial"
          : "expired";

  const grantMore = useCallback((ms: number) => {
    if (!uid) return;
    setUsed((current) => {
      const next = Math.max(0, current - ms);
      writeTrialUsed(uid, next);
      return next;
    });
  }, [uid]);

  return { state, remaining, used, subscribed, grantMore };
}
