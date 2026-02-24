# Chama Web (Front-end)

Front-end do **Chama**, um projeto de **videochamada** focado em uma experiência moderna, simples e escalável: autenticação com JWT, salas (Rooms) e, na sequência, integração com **WebRTC** para áudio/vídeo em tempo real.

> **Objetivo:** oferecer uma interface web rápida e bonita para:
> **Login / Cadastro → Sessão (/me) → Salas → Chamada.**

---

## ✨ O que esse front faz (agora)

- ✅ **Cadastro** de usuário (Register)
- ✅ **Login** (JWT)
- ✅ **Sessão persistida** via token no `localStorage`
- ✅ **Rotas protegidas** (bloqueia acesso sem token)
- ✅ **Integração com API Phoenix** rodando em `http://localhost:4000`

Próximos passos previstos:

- ⏭️ **Rooms** (criar, listar, entrar por código)
- ⏭️ **Chamada** (WebRTC + signaling)

---

## 🧠 Arquitetura (resumo)

- **Vite + React + TypeScript**
- **AuthProvider** mantém estado da sessão (token + user)
- Requests centralizados em `src/api/client.ts`
- Páginas:
  - `/login`
  - `/register`
  - `/` (protegida)

---

## 🧰 Tecnologias e bibliotecas

### Core

- **Vite** (build/dev server)
- **React**
- **TypeScript**

### UI / Estilo

- **TailwindCSS (v4)** usando `@tailwindcss/vite` (setup moderno)
- Componentes base custom: `Button`, `Input`, `Card`

### Forms e validação

- **react-hook-form**
- **zod**
- **@hookform/resolvers**

### Estado e UX

- **@tanstack/react-query** (pronto para cache/fetch de recursos como Rooms)
- **sonner** (toasts/notifications)
- **react-router-dom** (rotas)

---

## 📦 Requisitos

- **Node.js** recomendado: **22.13+** (ou superior compatível)
- **NPM** (ou pnpm/yarn, se preferir)
- API rodando localmente em:
  - `http://localhost:4000`

---

## 🚀 Instalação

Clone o repositório do front e instale as dependências:

```bash
npm install
```

````

Crie um arquivo `.env` na raiz do projeto:

```bash
VITE_API_BASE=http://localhost:4000
```

---

## ▶️ Rodando o projeto

### Dev server (modo desenvolvimento)

```bash
npm run dev
```

Acesse:

- Front: `http://localhost:5173`
- API: `http://localhost:4000`

### Build de produção

```bash
npm run build
```

### Pré-visualizar build

```bash
npm run preview
```

---

## 🧪 Testes rápidos (fluxo recomendado)

1. **Cadastre** em `/register`
2. Verifique se redireciona para `/` com sessão ativa
3. Faça **logout** e teste login em `/login`
4. Verifique se `/` só abre quando estiver autenticado

---

## ⌨️ Atalhos e comandos úteis

### NPM Scripts

- `npm run dev` — inicia o servidor de desenvolvimento
- `npm run build` — gera build de produção
- `npm run preview` — serve o build para testar localmente
- `npm run lint` — executa o ESLint (se configurado no projeto)

### Dica de limpeza (quando cache dá chilique)

Se algo ficar estranho após mexer em configs:

```bash
rm -rf node_modules .vite
npm install
npm run dev
```

---

## 🔐 Autenticação (como funciona)

- Ao fazer **login/register**, a API retorna um **JWT**.
- O token é salvo em `localStorage` como `access_token`.
- Requisições autenticadas incluem:
  - `Authorization: Bearer <token>`

- A rota `/` é protegida via `RequireAuth`.

---

## 📁 Estrutura de pastas (resumida)

```
src/
  api/
    client.ts       # fetch wrapper + token
    auth.ts         # endpoints de auth
  app/
    App.tsx
    router.tsx
    providers.tsx
  auth/
    AuthContext.ts
    AuthProvider.tsx
    RequireAuth.tsx
    useAuth.ts
  pages/
    Login.tsx
    Register.tsx
    Home.tsx
  ui/
    Button.tsx
    Input.tsx
    Card.tsx
```

---

## 🔌 Integração com a API

Este front espera que a API:

- aceite cadastro no formato:

  ```json
  { "user": { "name": "...", "email": "...", "password": "..." } }
  ```

- retorne `token` no login e register
- disponibilize `GET /api/me` protegido por JWT

Base URL configurável por ambiente:

- `.env` → `VITE_API_BASE`

---

## 📌 Roadmap (curto e direto)

- [x] Auth (Register/Login/Me + rotas protegidas)
- [ ] Rooms (CRUD + join)
- [ ] Lobby / sala (UI)
- [ ] WebRTC (mídia + track + troca de dispositivos)
- [ ] UX de chamada (mute, cam off, trocar camera, reconectar)

---

## 🧾 Licença

Uso livre dentro do projeto **Chama**. Ajuste conforme sua necessidade (MIT, etc).

```
::contentReference[oaicite:0]{index=0}
```
````
