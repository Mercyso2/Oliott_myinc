import fs from "node:fs";

const postRepo = fs.readFileSync("src/lib/repositories/post-repository.ts", "utf8");
const vercel = fs.existsSync("vercel.json") ? fs.readFileSync("vercel.json", "utf8") : "";
const workerRepo = fs.readFileSync("src/lib/repositories/generation-worker-repository.ts", "utf8");

if (postRepo.includes("process-production-queue")) throw new Error("Frontend ainda chama process-production-queue pesado.");
if (postRepo.includes("worker Vercel v3")) throw new Error("Mensagens antigas de worker Vercel ainda aparecem.");
if (!postRepo.includes("enqueue-generation")) throw new Error("Frontend não foi conectado ao enqueue-generation V2.");
if (vercel.includes("api/worker/process") || vercel.includes("crons")) throw new Error("vercel.json ainda mantém cron/worker pesado antigo.");
if (!workerRepo.includes("Motor Local EXE")) throw new Error("generation-worker-repository não foi neutralizado para Motor Local.");

console.log("v2-no-heavy-vercel-worker ok");
