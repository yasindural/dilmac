const allowedOrigins = new Set([
  "https://terraspeak.com",
  "https://www.terraspeak.com",
  "https://yasindural.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const buckets = new Map();
const json = (body, status = 200, origin = "") => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://terraspeak.com",
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
      "HTTP-Referer": "https://terraspeak.com/",
      "X-Title": title,
    },
    body: JSON.stringify(body),
  });
  return response;
};

// Paddle-Signature: "ts=...;h1=..." — govde HMAC-SHA256(secret, `${ts}:${body}`)
const verifyPaddleSignature = async (secret, header, rawBody) => {
  try {
    const parts = Object.fromEntries(header.split(";").map((part) => part.split("=")));
    if (!parts.ts || !parts.h1) return false;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.ts}:${rawBody}`));
    const hex = [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return hex === parts.h1;
  } catch {
    return false;
  }
};

const planFromEvent = (env, event) => {
  const type = String(event?.event_type || "");
  if (type === "subscription.canceled" || type === "subscription.paused") return "free";
  const active = type === "subscription.activated" || type === "subscription.updated"
    || type === "subscription.resumed" || type === "transaction.completed";
  if (!active) return null;
  const priceIds = (event?.data?.items || []).map((item) => item?.price?.id).filter(Boolean);
  if (env.PADDLE_PRICE_BUSINESS && priceIds.includes(env.PADDLE_PRICE_BUSINESS)) return "business";
  if (env.PADDLE_PRICE_PRO && priceIds.includes(env.PADDLE_PRICE_PRO)) return "pro";
  return null;
};

const sha256Hex = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
    const requestPath = new URL(request.url).pathname;

    // Ödeme sağlayıcısının webhook'u: origin kontrolünün DIŞINDA, imza ile
    // korunur. Plan değişiklikleri buradan D1'e yazılır; uygulama girişte
    // /plan ucundan doğrular.
    if (request.method === "POST" && requestPath === "/billing/webhook") {
      if (!env.PADDLE_WEBHOOK_SECRET) return new Response(JSON.stringify({ error: "not_configured" }), { status: 503 });
      const rawBody = await request.text();
      const signature = request.headers.get("Paddle-Signature") || "";
      const valid = await verifyPaddleSignature(env.PADDLE_WEBHOOK_SECRET, signature, rawBody);
      if (!valid) {
        await recordError(env, { area: "billing", code: "webhook_bad_signature", message: "Paddle imzası doğrulanamadı", page: requestPath });
        return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 401 });
      }
      let event;
      try { event = JSON.parse(rawBody); } catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 }); }
      const uid = String(event?.data?.custom_data?.uid || "").trim().slice(0, 128);
      const plan = planFromEvent(env, event);
      if (uid && plan) {
        try {
          await env.dilmac_logs.prepare(
            "INSERT INTO user_plans (uid, plan, source) VALUES (?1, ?2, ?3) ON CONFLICT(uid) DO UPDATE SET plan = ?2, source = ?3, updated_at = datetime('now')"
          ).bind(uid, plan, String(event?.event_type || "paddle")).run();
        } catch (dbError) {
          await recordError(env, { area: "billing", code: "plan_write_failed", message: clean(dbError?.message, 200), page: requestPath });
          return new Response(JSON.stringify({ error: "storage_failed" }), { status: 500 });
        }
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

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
    if (path === "/plan") {
      const uid = String(input.uid || "").trim().slice(0, 128);
      if (!uid) return json({ error: "invalid_request" }, 400, origin);
      try {
        const row = await env.dilmac_logs.prepare("SELECT plan FROM user_plans WHERE uid = ?1").bind(uid).first();
        return json({ plan: row?.plan || null }, 200, origin);
      } catch {
        // Tablo yoksa ya da D1 erişilemezse plan bilinmiyor kabul edilir.
        return json({ plan: null }, 200, origin);
      }
    }
    // --- E-posta doğrulama: 6 haneli kod ---
    // Kod, Resend üzerinden gönderilir. RESEND_API_KEY yoksa istemci 503'ü
    // görüp Firebase bağlantı yöntemine düşer; site hiçbir zaman kilitlenmez.
    if (path === "/auth/status") {
      const uid = String(input.uid || "").trim().slice(0, 128);
      if (!uid) return json({ error: "invalid_request" }, 400, origin);
      try {
        const row = await env.dilmac_logs.prepare("SELECT uid FROM verified_emails WHERE uid = ?1").bind(uid).first();
        return json({ verified: Boolean(row) }, 200, origin);
      } catch { return json({ verified: false }, 200, origin); }
    }
    if (path === "/auth/send-code") {
      if (!env.RESEND_API_KEY) return json({ error: "not_configured" }, 503, origin);
      const uid = String(input.uid || "").trim().slice(0, 128);
      const email = String(input.email || "").trim().toLowerCase().slice(0, 254);
      if (!uid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid_request" }, 400, origin);
      // Tekrar-gönderim freni: aynı hesaba dakikada en fazla bir kod.
      try {
        const existing = await env.dilmac_logs.prepare("SELECT created_at FROM email_codes WHERE uid = ?1").bind(uid).first();
        if (existing && Date.now() - Date.parse(`${existing.created_at.replace(" ", "T")}Z`) < 60_000) {
          return json({ error: "cooldown" }, 429, origin);
        }
      } catch { /* tablo yoksa migration eksik; aşağıdaki INSERT zaten hata verir */ }
      const random = new Uint32Array(1);
      crypto.getRandomValues(random);
      const code = String(100000 + (random[0] % 900000));
      const codeHash = await sha256Hex(`${uid}:${code}`);
      try {
        await env.dilmac_logs.prepare(
          "INSERT INTO email_codes (uid, email, code_hash, attempts, expires_at, created_at) VALUES (?1, ?2, ?3, 0, datetime('now','+10 minutes'), datetime('now')) ON CONFLICT(uid) DO UPDATE SET email = ?2, code_hash = ?3, attempts = 0, expires_at = datetime('now','+10 minutes'), created_at = datetime('now')"
        ).bind(uid, email, codeHash).run();
      } catch (dbError) {
        await recordError(env, { area: "auth", code: "code_write_failed", message: clean(dbError?.message, 200), page: path });
        return json({ error: "storage_failed" }, 500, origin);
      }
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.RESEND_FROM || "TerraSpeak <dogrulama@terraspeak.com>",
          to: [email],
          subject: `TerraSpeak doğrulama kodu: ${code}`,
          text: `TerraSpeak doğrulama kodunuz: ${code}\n\nKod 10 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.\n\n—\n\nYour TerraSpeak verification code: ${code}\nThe code is valid for 10 minutes. If you didn't request this, you can ignore this email.`,
        }),
      }).catch(() => null);
      if (!sent || !sent.ok) {
        await recordError(env, { area: "auth", code: `resend_${sent ? sent.status : "network"}`, message: "Doğrulama kodu e-postası gönderilemedi", page: path });
        return json({ error: "send_failed" }, 502, origin);
      }
      return json({ ok: true }, 200, origin);
    }
    if (path === "/auth/verify-code") {
      const uid = String(input.uid || "").trim().slice(0, 128);
      const code = String(input.code || "").trim();
      if (!uid || !/^\d{6}$/.test(code)) return json({ error: "invalid_request" }, 400, origin);
      let row;
      try {
        row = await env.dilmac_logs.prepare("SELECT email, code_hash, attempts, expires_at FROM email_codes WHERE uid = ?1").bind(uid).first();
      } catch { return json({ error: "storage_failed" }, 500, origin); }
      if (!row) return json({ error: "code_invalid" }, 400, origin);
      if (Date.parse(`${row.expires_at.replace(" ", "T")}Z`) < Date.now()) {
        return json({ error: "code_expired" }, 400, origin);
      }
      if (row.attempts >= 5) return json({ error: "too_many_attempts" }, 429, origin);
      const codeHash = await sha256Hex(`${uid}:${code}`);
      if (codeHash !== row.code_hash) {
        try { await env.dilmac_logs.prepare("UPDATE email_codes SET attempts = attempts + 1 WHERE uid = ?1").bind(uid).run(); } catch { /* yoksay */ }
        return json({ error: "code_invalid" }, 400, origin);
      }
      try {
        await env.dilmac_logs.prepare(
          "INSERT INTO verified_emails (uid, email, verified_at) VALUES (?1, ?2, datetime('now')) ON CONFLICT(uid) DO UPDATE SET email = ?2, verified_at = datetime('now')"
        ).bind(uid, row.email).run();
        await env.dilmac_logs.prepare("DELETE FROM email_codes WHERE uid = ?1").bind(uid).run();
      } catch (dbError) {
        await recordError(env, { area: "auth", code: "verified_write_failed", message: clean(dbError?.message, 200), page: path });
        return json({ error: "storage_failed" }, 500, origin);
      }
      return json({ ok: true }, 200, origin);
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
      // Birincil model (Gemini Flash) herhangi bir sebeple başarısız olursa
      // görüşme kesilmesin: bir kez de yedek modelle (mini) denenir.
      const translateWith = (model) => openRouter(env, {
          model,
          // Gemini gibi "dusunen" modellerde akil yurutme tokenlari cikti
          // butcesinden yenir ve ceviri yarida kesilir; ceviri icin dusunmeye
          // neredeyse hic gerek yok.
          //
          // DIKKAT: burada eskiden `reasoning: { enabled: false }` vardi ve her
          // istek OpenRouter'dan 400 donuyordu (100% basarisizlik; her ceviri
          // sessizce yedek modele dusuyordu). Sebep: Gemini 3.x ailesi eski
          // `thinkingBudget` yerine Google'in `thinkingLevel` API'sini kullanir.
          // OpenRouter `reasoning.effort` -> `thinkingLevel` esler; thinkingLevel'in
          // "kapali" karsiligi YOKTUR, en dusuk seviye "minimal"dir. Dolayisiyla
          // dusunmeyi tamamen kapatma istegi gecersiz sayiliyordu.
          // "minimal" pratikte en yakin karsilik: hizli, ucuz, uydurma yapmaz.
          reasoning: { effort: "minimal" },
          // temperature 0: canli ceviride yaraticilik istemiyoruz. Onceki
          // prompt "bir yerlinin konustugu gibi yaz" diyordu; konusma tanima
          // bozuk/kisa bir parca urettiginde model bunu duzeltmek yerine
          // kulaga dogru gelen YENI bir cumle uyduruyordu. Kullanicinin
          // "hic soylemedigim seyleri yazdi" sikayeti buydu.
          temperature: 0,
          // Dusunme tokenlari da bu butceden yenir. 500 ile ceviri yarida
          // kesilebiliyordu; tavan yukseltmek maliyeti artirmaz (yalnizca
          // gercekten uretilen token faturalanir), sadece kesilmeyi onler.
          max_tokens: 2000,
          messages: [
            {
              role: "system",
              content: [
                `You are a translation engine. Translate the user message into ${target}.`,
                "Rules you must never break:",
                "1. Translate ONLY what is written. Never add, remove, explain, summarise or continue the thought.",
                "2. Never answer the message. You are not a conversation partner.",
                "3. Keep the speaker's register: everyday spoken wording, contractions, and the original tone (question stays a question).",
                "4. If the input is garbled, meaningless, a single filler sound, or already in the target language, return it EXACTLY as received. Do not invent a plausible sentence.",
                "5. Output the translation and nothing else - no quotes, no notes, no markdown, no arrows.",
                "6. Give exactly ONE translation. Never list alternatives separated by slashes.",
              ].join("\n"),
            },
            { role: "user", content: text },
          ],
        }, "Dilmaç");
      const primaryModel = env.OPENROUTER_MODEL || "google/gemini-3.7-flash";
      const fallbackModel = env.OPENROUTER_FALLBACK_MODEL || "openai/gpt-4.1-mini";
      try {
        response = await translateWith(primaryModel);
        if (!response.ok && primaryModel !== fallbackModel) {
          // Ust akisin GERCEK hata metnini de kaydet. Onceki surumde yalnizca
          // "basarisiz, yedek denenecek" yaziliyordu; bu yuzden 15 dakikada 42
          // kez tekrarlayan 400'un sebebi loglardan hic anlasilamadi.
          const reason = await response.text().then(
            (raw) => clean(raw, 300),
            () => "govde okunamadi",
          );
          await recordError(env, { area: "translation", code: `model_fallback_${response.status}`, message: `${primaryModel} basarisiz (${reason}), ${fallbackModel} denenecek`, page: path });
          response = await translateWith(fallbackModel);
        }
      } catch (requestError) {
        const timedOut = requestError?.name === "TimeoutError" || requestError?.name === "AbortError";
        if (primaryModel !== fallbackModel) {
          try {
            response = await translateWith(fallbackModel);
          } catch {
            await recordError(env, { area: "translation", code: timedOut ? "openrouter_timeout" : "openrouter_network", message: clean(requestError?.message, 200), page: path });
            return json({ error: timedOut ? "upstream_timeout" : "upstream_network" }, 504, origin);
          }
        } else {
          await recordError(env, { area: "translation", code: timedOut ? "openrouter_timeout" : "openrouter_network", message: clean(requestError?.message, 200), page: path });
          return json({ error: timedOut ? "upstream_timeout" : "upstream_network" }, 504, origin);
        }
      }
      if (!response.ok) {
        await recordError(env, { area: "translation", code: `openrouter_${response.status}`, message: "OpenRouter translation request failed", page: path });
        return json({ error: "upstream_error" }, response.status, origin);
      }
      const payload = await response.json();
      const translated = payload.choices?.[0]?.message?.content || "";
      // 200 dondugu halde icerik bos kalabilir: dusunme tokenlari cikti
      // butcesini bitirirse finish_reason "length" olur ve content bos gelir.
      // Bos ceviri kullaniciya bos balon olarak dusmesin - yedek modelle bir
      // kez daha dene.
      if (!translated.trim() && primaryModel !== fallbackModel) {
        await recordError(env, { area: "translation", code: "empty_completion", message: `${primaryModel} bos icerik dondurdu (finish_reason=${clean(payload.choices?.[0]?.finish_reason, 40)}), ${fallbackModel} denenecek`, page: path, level: "warning" });
        const retry = await translateWith(fallbackModel);
        if (retry.ok) {
          const retryPayload = await retry.json();
          return json({ text: retryPayload.choices?.[0]?.message?.content || "" }, 200, origin);
        }
      }
      return json({ text: translated }, 200, origin);
    }

    if (path === "/practice") {
      const text = String(input.text || "").trim().slice(0, 1200);
      const userLanguage = String(input.userLanguage || "").slice(0, 40);
      const partnerLanguage = String(input.partnerLanguage || "").slice(0, 40);
      const history = Array.isArray(input.history) ? input.history.slice(-6) : [];
      if (!text || !userLanguage || !partnerLanguage) return json({ error: "invalid_request" }, 400, origin);
      const makeRequest = (model) => openRouter(env, {
        model,
        // /translate ile ayni sebep: Gemini 3.x thinkingLevel kullanir ve
        // "kapali" seviyesi yoktur, en dusugu "minimal". `enabled: false`
        // OpenRouter'dan 400 donduruyordu.
        reasoning: { effort: "minimal" },
        temperature: 0.45,
        // Dusunme tokenlari da bu butceden yeniyor; ustelik cikti bir JSON
        // nesnesi (3 alan). 260 fazlasiyla dardi.
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `You are a real person having a casual voice chat, not an assistant. The human speaks ${userLanguage}; you speak ${partnerLanguage}. Sound genuinely human: everyday spoken language, contractions, natural reactions ("oh nice", "hmm"), react to what they actually said, and about every other turn ask a short natural follow-up question to keep the chat alive. Never lecture, never list, never sound like a textbook. Keep replies to one or two short spoken sentences. Return only valid JSON with exactly these string keys: userTranslation (their message translated into ${partnerLanguage}), reply (your reply in ${partnerLanguage}), replyTranslation (your reply translated into ${userLanguage}). Never add markdown.` },
          { role: "user", content: JSON.stringify({ previousConversation: history, latestMessage: text }) },
        ],
      }, "Dilmaç AI Deneme");
      let response;
      try {
        response = await makeRequest(env.OPENROUTER_MODEL || "google/gemini-3.7-flash");
        if (!response.ok) response = await makeRequest(env.OPENROUTER_FALLBACK_MODEL || "openai/gpt-4.1-mini");
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
