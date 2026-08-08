import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";

const planPath = resolve(process.argv[2] || "orchestra-plan.json");
const root = dirname(planPath);
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY eksik.");
const plan = JSON.parse(await readFile(planPath, "utf8"));
const forbidden = /(^|[\\/])(\.env(?:\.|$)|\.git|node_modules|dist|\.wrangler)([\\/]|$)/i;

async function loadFiles(paths) {
  let size = 0;
  const blocks = [];
  for (const file of paths) {
    const absolute = resolve(root, file);
    const rel = relative(root, absolute);
    if (!rel || rel.startsWith(`..${sep}`) || forbidden.test(rel)) throw new Error(`Gönderilemeyen dosya: ${file}`);
    const content = await readFile(absolute, "utf8");
    size += content.length;
    if (size > 180_000) throw new Error(`Dosya sınırı aşıldı: ${file}`);
    blocks.push(`--- FILE: ${rel.replaceAll("\\", "/")} ---\n${content}`);
  }
  return blocks.join("\n\n");
}

async function ask(model, system, prompt, maxTokens = 3500) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(180_000),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/yasindural/dilmac",
      "X-Title": "Dilmac Development Orchestra",
    },
    body: JSON.stringify({ model, temperature: 0.1, max_tokens: maxTokens, messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ] }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${model} başarısız (${response.status}): ${payload?.error?.message || "Bilinmeyen hata"}`);
  const message = payload?.choices?.[0]?.message;
  const content = typeof message?.content === "string"
    ? message.content
    : Array.isArray(message?.content)
      ? message.content.map((part) => typeof part === "string" ? part : part?.text || "").join("\n")
      : typeof message?.reasoning === "string"
        ? message.reasoning
        : "";
  if (!content.trim()) throw new Error(`${model} boş cevap verdi (finish_reason: ${payload?.choices?.[0]?.finish_reason || "unknown"}).`);
  return content.trim();
}

const workerSystem = `You are a read-only specialist in a supervised software engineering orchestra.
Inspect only the supplied code. Never request secrets. Do not claim execution or deployment.
Report evidence with file names and concrete failure paths. Preserve working desktop audio behavior.
Return: FINDINGS (P0-P3), SAFE FIXES, TESTS, and DO-NOT-CHANGE.`;

const outputDir = resolve(root, ".orchestra-output");
await mkdir(outputDir, { recursive: true });
const workerResults = await Promise.allSettled(plan.workers.map(async (worker) => {
  const files = await loadFiles(worker.files);
  const prompt = `MISSION:\n${plan.mission}\n\nYOUR FOCUS:\n${worker.focus}\n\nCODE:\n${files}`;
  const report = await ask(worker.model, workerSystem, prompt);
  const result = { ...worker, report };
  await writeFile(resolve(outputDir, `${worker.name}.md`), `${report}\n`, "utf8");
  return result;
}));
const reports = workerResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
const failures = workerResults.flatMap((result, index) => result.status === "rejected" ? [`${plan.workers[index].name}: ${result.reason?.message || result.reason}`] : []);
if (reports.length === 0) throw new Error(`Hiçbir uzman raporu üretilemedi. ${failures.join(" | ")}`);

const synthesisInput = reports.map((item) => `=== ${item.name} (${item.model}) ===\n${item.report}`).join("\n\n");
const conductorSystem = `You are the chief reviewer of a supervised development orchestra. You receive independent audit reports, not ground truth. Reject unsupported claims, merge duplicates, flag conflicts, and produce a safe implementation order. You cannot claim tests were run.`;
const finalReport = await ask(plan.conductor.model, conductorSystem, `MISSION:\n${plan.mission}\n\nCONDUCTOR RULES:\n${plan.conductor.instruction}\n\nSPECIALIST REPORTS:\n${synthesisInput}`, 5000);

await writeFile(resolve(outputDir, "conductor-report.md"), `${finalReport}\n\n## Ulaşılamayan uzmanlar\n${failures.length ? failures.map((item) => `- ${item}`).join("\n") : "- Yok"}\n`, "utf8");
console.log(`Orkestra raporu hazır: ${resolve(outputDir, "conductor-report.md")}`);
