const UPSTREAM = "https://dilmac-api.yasdural.workers.dev";
const ALLOWED_ORIGINS = new Set([
  "https://terraspeak.com",
  "https://www.terraspeak.com",
  "https://yasindural.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export default async function handler(request, response) {
  const origin = request.headers.origin || "";
  const requestUrl = new URL(request.url, "https://dilmac-api-bridge.vercel.app");
  const path = requestUrl.pathname.replace(/^\/api/, "") || "/";

  response.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://yasindural.github.io");
  response.setHeader("Vary", "Origin");
  response.setHeader("Cache-Control", "no-store");

  if (path === "/health") return response.status(200).json({ ok: true, bridge: "vercel" });
  if (!ALLOWED_ORIGINS.has(origin)) return response.status(403).json({ error: "forbidden" });
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return response.status(204).end();
  }
  if (request.method !== "POST") return response.status(405).json({ error: "method_not_allowed" });

  try {
    const upstreamResponse = await fetch(`${UPSTREAM}${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(25_000),
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(request.body || {}),
    });
    const body = await upstreamResponse.text();
    response.status(upstreamResponse.status);
    response.setHeader("Content-Type", upstreamResponse.headers.get("Content-Type") || "application/json; charset=utf-8");
    return response.send(body);
  } catch (error) {
    return response.status(502).json({ error: "bridge_unavailable", message: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
  }
}
