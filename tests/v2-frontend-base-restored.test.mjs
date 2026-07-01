import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }

const layout = read("src/components/app-layout.tsx");
const sidebar = read("src/components/sidebar-nav.tsx");
const styles = read("src/styles.css");

if (!layout.includes("MYINC Creative Studio")) throw new Error("AppLayout base do GitHub não foi restaurado.");
if (!layout.includes("2.0 · Local Engine")) throw new Error("Versão V2 não aplicada no AppLayout.");
if (!sidebar.includes("Cérebro da IA") || !sidebar.includes("Memória da Marca")) throw new Error("Sidebar base do GitHub não preservada.");
if (!sidebar.includes("Fila V2") || !sidebar.includes("Motor Local")) throw new Error("Rotas V2 não adicionadas na sidebar preservada.");
if (!styles.includes("--sidebar") || !styles.includes("bg-gradient-primary")) throw new Error("Tema visual base não preservado.");

console.log("v2-frontend-base-restored ok");
