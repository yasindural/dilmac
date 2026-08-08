const allowedOrigins = new Set([
  "https://yasindural.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const buckets = new Map();
const json = (body, status = 200, origin = "") => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://yasindural.github.io",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  },
});

const limited = (request) => {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const windowId = Math.floor(Date.now() / 3_600_000);
  const key = `${ip}:${windowId}`;
  const count = (buckets.get(key) || 0) + 1;
  buckets.set(key, count);
  if (buckets.size > 5000) buckets.clear();
  return count > 120;
};

const openRouter = async (env, body, title) => {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(18_000),
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://yasindural.github.io/dilmac/",
      "X-Title": title,
    },
    body: JSON.stringify(body),
  });
  return response;
};

const clean = (value, max) => String(value ?? "").replace(/sk-or-v1-[a-z0-9]+/gi, "[secret]").slice(0, max);
const recordError = async (env, entry) => {
  const safe = {
    level: clean(entry.level || "error", 12),
    area: clean(entry.area || "unknown", 40),
    code: clean(entry.code || "unknown", 80),
    message: clean(entry.message || "Unknown error", 300),
    page: clean(entry.page || "", 120),
    userAgent: clean(entry.userAgent || "", 240),
  };
  console.log(JSON.stringify({ event: "dilmac_error", ...safe }));
  try {
    await env.dilmac_logs.prepare(
      "INSERT INTO error_logs (level, area, code, message, page, user_agent) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(safe.level, safe.area, safe.code, safe.message, safe.page, safe.userAgent).run();
  } catch (logError) {
    console.error(JSON.stringify({ event: "log_write_failed", message: clean(logError?.message, 200) }));
  }
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (!allowedOrigins.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      }});
    }
    if (!allowedOrigins.has(origin)) return json({ error: "forbidden" }, 403, origin);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
    if (limited(request)) return json({ error: "rate_limited" }, 429, origin);
    let input;
    try { input = await request.json(); } catch { return json({ error: "invalid_json" }, 400, origin); }
    const path = new URL(request.url).pathname;
    if (path === "/log") {
      await recordError(env, input || {});
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Vary": "Origin",
        "Cache-Control": "no-store",
      }});
    }
    if (!env.OPENROUTER_API_KEY) {
      await recordError(env, { area: "backend", code: "service_not_configured", message: "OpenRouter secret is missing", page: path });
      return json({ error: "service_not_configured" }, 503, origin);
    }
    if (path === "/translate") {
      const text = String(input.text || "").trim().slice(0, 1200);
      const target = String(input.target || "").trim().slice(0, 40);
      if (!text || !target) return json({ error: "invalid_request" }, 400, origin);
      let response;
      try {
        response = await openRouter(env, {
          model: env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
          temperature: 0.2,
          max_tokens: 500,
          messages: [
            { role: "system", content: `Translate naturally into ${target}. Return only the translation.` },
            { role: "user", content: text },
          ],
        }, "Dilmaç");
      } catch (requestError) {
        const timedOut = requestError?.name === "TimeoutError" || requestError?.name === "AbortError";
        await recordError(env, { area: "translation", code: timedOut ? "openrouter_timeout" : "openrouter_network", message: clean(requestError?.message, 200), page: path });
        return json({ error: timedOut ? "upstream_timeout" : "upstream_network" }, 504, origin);
      }
      if (!response.ok) {
        await recordError(env, { area: "translation", code: `openrouter_${response.status}`, message: "OpenRouter translation request failed", page: path });
        return json({ error: "upstream_error" }, response.status, origin);
      }
      const payload = await response.json();
      return json({ text: payload.choices?.[0]?.message?.content || "" }, 200, origin);
    }

    if (path === "/practice") {
      const text = String(input.text || "").trim().slice(0, 1200);
      const userLanguage = String(input.userLanguage || "").slice(0, 40);
      const partnerLanguage = String(input.partnerLanguage || "").slice(0, 40);
      const history = Array.isArray(input.history) ? input.history.slice(-6) : [];
      if (!text || !userLanguage || !partnerLanguage) return json({ error: "invalid_request" }, 400, origin);
      const makeRequest = (model) => openRouter(env, {
        model,
        temperature: 0.45,
        max_tokens: 180,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `You are a friendly, concise conversation partner for testing live translation. The human speaks ${userLanguage}; you speak ${partnerLanguage}. Return only valid JSON with exactly these string keys: userTranslation, reply, replyTranslation. Keep the reply to one or two sentences. Never add markdown.` },
          { role: "user", content: JSON.stringify({ previousConversation: history, latestMessage: text }) },
        ],
      }, "Dilmaç AI Deneme");
      let response;
      try {
        response = await makeRequest(env.OPENROUTER_MODEL || "openai/gpt-4.1-mini");
        if (response.status === 402) response = await makeRequest("openrouter/free");
      } catch (requestError) {
        const timedOut = requestError?.name === "TimeoutError" || requestError?.name === "AbortError";
        await recordError(env, { area: "practice", code: timedOut ? "openrouter_timeout" : "openrouter_network", message: clean(requestError?.message, 200), page: path });
        return json({ error: timedOut ? "upstream_timeout" : "upstream_network" }, 504, origin);
      }
      if (!response.ok) {
        await recordError(env, { area: "practice", code: `openrouter_${response.status}`, message: "OpenRouter practice request failed", page: path });
        return json({ error: "upstream_error" }, response.status, origin);
      }
      const payload = await response.json();
      return json({ content: payload.choices?.[0]?.message?.content || "" }, 200, origin);
    }
    return json({ error: "not_found" }, 404, origin);
  },
};
