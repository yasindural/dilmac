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
  {
    name: "fast-question",
    text: "Bir saniye, otobüs 24 numara mı?",
    target: "English",
    mustKeep: ["24"],
    mustContain: ["?"],
  },
  {
    name: "filler-must-not-hallucinate",
    text: "ııı...",
    target: "English",
    mustKeep: [],
    exact: "ııı...",
  },
  {
    name: "long-spoken-turn",
    text: "Şimdi seni net duyuyorum. Biraz önce bağlantı kısa süreliğine kesildi ama sorun değil. Yarın saat 09:20'de terminal C7'nin önünde buluşalım. Yanında pasaportunu ve rezervasyon numarası TR482'yi getir. Eğer trafik yoğun olursa beni ara; ben de konumumu tekrar paylaşırım. Böylece birbirimizi beklemeden doğrudan buluşma noktasına geçebiliriz.",
    target: "English",
    mustKeep: ["09", "20", "C7", "TR482"],
  },
];

const normalize = (value) => String(value || "").normalize("NFKC");
const lower = (value) => normalize(value).toLocaleLowerCase("tr");
const results = [];
let failed = false;

async function translateCase(testCase) {
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
    return { name: testCase.name, ok: false, latencyMs: Date.now() - started, error: String(error) };
  }

  const latencyMs = Date.now() - started;
  const translated = normalize(payload?.text).trim();
  const translatedLower = lower(translated);
  const missingTokens = (testCase.mustKeep || []).filter((token) => !translatedLower.includes(lower(token)));
  const missingContent = (testCase.mustContain || []).filter((token) => !translated.includes(token));
  const exactMismatch = testCase.exact !== undefined && translated !== normalize(testCase.exact).trim();
  const suspiciouslyLong = translated.length > testCase.text.length * 3 + 40;
  const ok = response.ok
    && translated.length > 0
    && missingTokens.length === 0
    && missingContent.length === 0
    && !exactMismatch
    && !suspiciouslyLong
    && latencyMs <= MAX_LATENCY_MS;

  return {
    name: testCase.name,
    ok,
    status: response.status,
    latencyMs,
    sourceChars: testCase.text.length,
    translatedChars: translated.length,
    missingTokens,
    missingContent,
    exactMismatch,
    suspiciouslyLong,
  };
}

for (const testCase of cases) {
  const result = await translateCase(testCase);
  if (!result.ok) failed = true;
  results.push(result);
}

// Hızlı konuşmada STT kısa parçalar üretebilir. API'ye neredeyse aynı anda
// gerçek istekler göndererek zincirin yük altında cümle kaybetmediğini ve
// her parçadaki benzersiz numarayı koruduğunu kontrol et. Mock kullanılmaz.
const burstCases = [701, 702, 703, 704, 705, 706].map((token, index) => ({
  name: `burst-${index + 1}`,
  text: `Kısa konuşma parçası ${token}: lütfen bunu aynen anlamını koruyarak çevir.`,
  target: "English",
  mustKeep: [String(token)],
}));
const burstStarted = Date.now();
const burstResults = await Promise.all(burstCases.map((testCase) => translateCase(testCase)));
const burstElapsedMs = Date.now() - burstStarted;
for (const result of burstResults) {
  if (!result.ok) failed = true;
  results.push(result);
}
if (burstElapsedMs > MAX_LATENCY_MS + 3000) failed = true;

console.table(results);
const latencies = results
  .filter((item) => typeof item.latencyMs === "number")
  .map((item) => item.latencyMs)
  .sort((a, b) => a - b);
if (latencies.length) {
  const p50 = latencies[Math.floor((latencies.length - 1) * 0.5)];
  const p95 = latencies[Math.floor((latencies.length - 1) * 0.95)];
  console.log(`Gerçek çeviri gecikmesi: p50=${p50}ms p95=${p95}ms`);
}
console.log(`Hızlı 6 parçalık gerçek burst toplamı: ${burstElapsedMs}ms`);

if (failed) {
  console.error("REAL_TRANSLATION_SMOKE_FAILED");
  process.exit(1);
}
console.log("REAL_TRANSLATION_SMOKE_OK");
