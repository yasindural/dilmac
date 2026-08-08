const recent = new Map<string, number>();

const clean = (value: unknown, max = 300) => String(value ?? "").replace(/sk-or-v1-[a-z0-9]+/gi, "[secret]").slice(0, max);

export function logClientError(code: string, area: string, message: unknown, level: "warning" | "error" = "error") {
  const apiBase = import.meta.env.VITE_DILMAC_API_URL?.replace(/\/$/, "");
  if (!apiBase) return;
  const dedupeKey = `${area}:${code}`;
  const now = Date.now();
  if (now - (recent.get(dedupeKey) || 0) < 60_000) return;
  recent.set(dedupeKey, now);
  void fetch(`${apiBase}/log`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level,
      area: clean(area, 40),
      code: clean(code, 80),
      message: clean(message),
      page: clean(location.pathname, 120),
      userAgent: clean(navigator.userAgent, 240),
    }),
  }).catch(() => undefined);
}

export function installGlobalErrorLogging() {
  window.addEventListener("error", (event) => logClientError("window_error", "frontend", event.message));
  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason instanceof Error ? event.reason.message : event.reason;
    logClientError("unhandled_rejection", "frontend", message);
  });
}
