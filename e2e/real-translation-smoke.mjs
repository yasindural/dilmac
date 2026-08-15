// TerraSpeak gerçek çeviri smoke testi.
// Mock YOK: üretimde kullanılan HTTP çeviri zincirine gerçek istek atar.
// Secret içermez; yalnızca herkese açık TerraSpeak API köprüsünü kullanır.

const API_BASE = (process.env.TERRASPEAK_API_URL || "https://dilmac-api-bridge.vercel.app/api").replace(/\/$/, "");
const MAX_LATENCY_MS = Number(process.env.TERRASPEAK_MAX_TRANSLATION_MS || 12000);

const cases = [
  {
    name: "tr-en-number",
    text: "Toplantı 14:35'te, salon B12'de başlayacak.",
    target: "English",
    mustKeep: ["14", "35", "B12"],
  },
  {
    name: "en-tr-number",
    text: "My flight is delayed by 45 minutes.",
    target: "Turkish",
    mustKeep: ["45"],
  },
  {
    name: "de-en-name",
    text: "Bitte senden Sie die Rechnung an Ayşe Demir.",
    target: "English",
    mustKeep: ["Ayşe", "Demir"],
  },
  {
    name: "short-conversation",
    text: "Bir dakika, seni şimdi daha iyi duyuyorum.",
    target: "English",
    mustKeep: [],
  },
];

const normalize = (value) => String(value || "").normalize("NFKC");
const results = [];
let failed = false;

for (const testCase of cases) {
  const started = Date.now();
  let response;
  let payload;
  try {
    response = await fetch(`${API_BASE}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://terraspeak.com",
      },
      body: JSON.stringify({ text: testCase.text, target: testCase.target }),
      signal: AbortSignal.timeout(MAX_LATENCY_MS + 2000),
    });
    payload = await response.json().catch(() => ({}));
  } catch (error) {
    failed = true;
    results.push({ name: testCase.name, ok: false, latencyMs: Date.now() - started, error: String(error) });
    continue;
  }

  const latencyMs = Date.now() - started;
  const translated = normalize(payload?.text).trim();
  const preserved = testCase.mustKeep.filter((token) => !translated.toLocaleLowerCase("tr").includes(normalize(token).toLocaleLowerCase("tr")));
  const suspiciouslyLong = translated.length > testCase.text.length * 3 + 40;
  const ok = response.ok && translated.length > 0 && preserved.length === 0 && !suspiciouslyLong && latencyMs <= MAX_LATENCY_MS;
  if (!ok) failed = true;
  results.push({
    name: testCase.name,
    ok,
    status: response.status,
    latencyMs,
    sourceChars: testCase.text.length,
    translatedChars: translated.length,
    missingTokens: preserved,
    suspiciouslyLong,
  });
}

console.table(results);
const latencies = results.filter((item) => typeof item.latencyMs === "number").map((item) => item.latencyMs).sort((a, b) => a - b);
if (latencies.length) {
  const p50 = latencies[Math.floor((latencies.length - 1) * 0.5)];
  const p95 = latencies[Math.floor((latencies.length - 1) * 0.95)];
  console.log(`Gerçek çeviri gecikmesi: p50=${p50}ms p95=${p95}ms`);
}

if (failed) {
  console.error("REAL_TRANSLATION_SMOKE_FAILED");
  process.exit(1);
}
console.log("REAL_TRANSLATION_SMOKE_OK");
