import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

const repoRoot = resolve(process.cwd());
const taskPath = resolve(repoRoot, process.argv[2] || "claude-task.local.json");
const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.CLAUDE_WORKER_MODEL || "anthropic/claude-sonnet-5";
const forbidden = /(^|[\\/])(\.env(?:\.|$)|\.git|node_modules|dist|\.wrangler)([\\/]|$)/i;

if (!apiKey) throw new Error("OPENROUTER_API_KEY yalnızca bu işlem için ortam değişkeni olarak verilmelidir.");

const task = JSON.parse(await readFile(taskPath, "utf8"));
if (!task.objective || !Array.isArray(task.files) || task.files.length === 0) {
  throw new Error("Görev dosyasında objective ve en az bir files kaydı olmalıdır.");
}

let totalChars = 0;
const sources = [];
for (const requestedPath of task.files) {
  const absolutePath = resolve(repoRoot, requestedPath);
  const insideRepo = relative(repoRoot, absolutePath);
  if (!insideRepo || insideRepo.startsWith(`..${sep}`) || forbidden.test(insideRepo)) {
    throw new Error(`Güvenlik nedeniyle bu dosya gönderilemez: ${requestedPath}`);
  }
  const content = await readFile(absolutePath, "utf8");
  totalChars += content.length;
  if (totalChars > 120_000) throw new Error("Seçilen dosyalar 120.000 karakter sınırını aşıyor.");
  sources.push(`--- FILE: ${insideRepo.replaceAll("\\", "/")} ---\n${content}`);
}

const systemPrompt = `You are the implementation worker in a two-agent software workflow.
The supervising agent owns architecture, scope, review, testing, and deployment.
Your job is to propose the smallest production-safe code change for the stated objective.
Never request or reveal secrets. Never modify .env files, credentials, deployment secrets, billing, or unrelated files.
Preserve existing behavior unless the objective explicitly changes it.
Return exactly these sections:
1. ANALYSIS: concise root cause and approach.
2. PATCH: one valid unified diff in a fenced diff block, limited to supplied files.
3. TESTS: exact checks the supervising agent should run.
Do not claim that you executed, applied, tested, committed, or deployed anything.`;

const userPrompt = `OBJECTIVE:\n${task.objective}\n\nACCEPTANCE CRITERIA:\n${(task.acceptanceCriteria || []).map((item) => `- ${item}`).join("\n")}\n\nCURRENT FILES:\n${sources.join("\n\n")}`;

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  signal: AbortSignal.timeout(120_000),
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/yasindural/dilmac",
    "X-Title": "Dilmac Claude Worker",
  },
  body: JSON.stringify({
    model,
    temperature: 0.1,
    max_tokens: 6000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  }),
});

const payload = await response.json();
if (!response.ok) throw new Error(`OpenRouter isteği başarısız (${response.status}): ${payload?.error?.message || "Bilinmeyen hata"}`);
const answer = payload?.choices?.[0]?.message?.content;
if (typeof answer !== "string" || !answer.trim()) throw new Error("Claude boş cevap verdi.");

const outputDir = resolve(repoRoot, ".claude-agent-output");
await mkdir(outputDir, { recursive: true });
const outputPath = resolve(outputDir, "latest-response.md");
await writeFile(outputPath, `${answer.trim()}\n`, "utf8");
console.log(`Claude çıktısı hazır: ${outputPath}`);
