import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";

// Para onde o Vite encaminha /api e /socket (a chama-api rodando na sua máquina).
const API_TARGET = process.env.API_TARGET ?? "http://localhost:4000";

export default defineConfig(async () => {
  const plugins: PluginOption[] = [react(), tailwindcss()];

  // HTTPS=1 npm run dev  →  certificado autoassinado (necessário para câmera/microfone no celular).
  if (process.env.HTTPS === "1") {
    try {
      const pkg = "@vitejs/plugin-basic-ssl"; // variável: não quebra o tsc se o pacote não estiver instalado
      const { default: basicSsl } = await import(pkg);
      plugins.push(basicSsl());
    } catch {
      console.warn("\n⚠ HTTPS=1, mas falta o pacote. Rode: npm i -D @vitejs/plugin-basic-ssl\n");
    }
  }

  return {
    plugins,
    server: {
      // Hosts de túnel (plano B para testar no celular sem depender da rede local).
      allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.app"],
      // Com `VITE_API_BASE=` (vazio) o front fala só com o Vite e ele repassa à API:
      // sem CORS, sem "mixed content" e sem expor a API na rede.
      proxy: {
        "/api": { target: API_TARGET },
        "/socket": { target: API_TARGET, ws: true },
      },
    },
  };
});
