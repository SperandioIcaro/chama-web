// `npm run dev:lan` — front exposto na rede em HTTPS (câmera/microfone no celular exigem HTTPS).
// Instala o plugin de certificado na primeira vez, mostra o endereço para abrir no celular e sobe o Vite.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join } from "node:path";

const PORT = process.env.PORT ?? "5173";
const isWin = process.platform === "win32";
const PLUGIN = "@vitejs/plugin-basic-ssl";

if (!existsSync(join(process.cwd(), "node_modules", PLUGIN, "package.json"))) {
  console.log(`Instalando ${PLUGIN} (certificado HTTPS de desenvolvimento)…`);
  const result = spawnSync("npm", ["install", "-D", PLUGIN], { stdio: "inherit", shell: isWin });
  if (result.status !== 0) {
    console.error(`\nNão consegui instalar. Rode manualmente: npm i -D ${PLUGIN}`);
    process.exit(1);
  }
}

const addresses = Object.entries(networkInterfaces()).flatMap(([name, list]) =>
  (list ?? [])
    .filter((i) => i.family === "IPv4" && !i.internal && !/^(docker|br-|veth|virbr|tailscale|zt)/.test(name))
    .map((i) => ({ name, address: i.address })),
);

console.log("\n📱 No celular (mesmo Wi-Fi), abra:");
for (const { name, address } of addresses) console.log(`   https://${address}:${PORT}   (${name})`);
console.log("   1ª vez: aceite o aviso do certificado (Avançado → continuar).\n");

const child = spawn("npx", ["vite", "--host", "--port", PORT, "--strictPort"], {
  stdio: "inherit",
  shell: isWin,
  env: { ...process.env, HTTPS: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
