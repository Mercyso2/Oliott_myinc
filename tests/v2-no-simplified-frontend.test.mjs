import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const scripts = JSON.stringify(pkg.scripts || {});
if (scripts.includes("apps/web")) throw new Error("package.json ainda aponta para frontend simplificado apps/web.");
if (fs.existsSync("apps/web/package.json")) throw new Error("apps/web simplificado ainda está ativo. Ele deve ser arquivado, não usado.");
if (!fs.existsSync("src/routes/__root.tsx")) throw new Error("Frontend base em src/routes não encontrado.");

console.log("v2-no-simplified-frontend ok");
