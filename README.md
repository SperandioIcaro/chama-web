# 🔥 Chama Web

Front-end do **Chama**: videochamadas em **salas privadas por convite** e uma **sala geral** aberta (mural em tempo real),
com o visual do NLW Heat (fundo escuro, rosa `#FF008E` e amarelo `#FFCD1E`, avatares com anel degradê).

## O que tem

- **Login**: GitHub (OAuth) **ou** conta Chama (email + senha com validação forte, igual à da API)
- **Sala geral** (`/`): mural estilo Heat — últimas 3 mensagens, novas entram a cada 3 s, histórico salvo no servidor
- **Salas privadas** (`/rooms`): crie, copie o **link de convite**, entre por código/link, convide quem está online
- **Chamada de vídeo** (`/rooms/:code`): até 6 pessoas (WebRTC em malha), microfone/câmera, chat e lista de pessoas
- **Multiplataforma**: responsivo (celular, tablet, desktop), instalável como app (manifest PWA) e com a API pronta para um app nativo

## Rodando

```bash
cp .env.example .env      # ajuste VITE_API_BASE e VITE_GITHUB_CLIENT_ID
npm install
npm run dev               # http://localhost:5173
```

Requer a [chama-api](../chama-api-main) rodando (padrão `http://localhost:4000`).

### Login com GitHub

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**
2. _Authorization callback URL_: `http://localhost:5173/auth/github/callback` (em produção, o domínio do front)
3. Coloque o **Client ID** em `VITE_GITHUB_CLIENT_ID` (front) e Client ID + **Secret** em `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` (API)

### Testando no celular (mesma rede Wi-Fi)

```bash
# 1) no .env do front, deixe a API pelo proxy do Vite (e apague/comente o VITE_WS_URL):
VITE_API_BASE=

# 2) rode a API (./run.sh) e, em outro terminal:
npm run dev:lan        # HTTPS + exposto na rede; mostra o endereço para abrir no celular
```

Câmera e microfone **só funcionam em HTTPS**, por isso o `dev:lan` já sobe com certificado autoassinado
(instala o `@vitejs/plugin-basic-ssl` sozinho na primeira vez). Na primeira abertura no celular, aceite o aviso
("Avançado → continuar"). Quer HTTP puro (sem vídeo)? `npm run dev:http`.
O login com GitHub não funciona por IP (o callback do OAuth App é fixo); use email e senha no celular.

### Chamada de vídeo

- Câmera/microfone só funcionam em **HTTPS** ou `localhost`.
- Sem servidor **TURN**, cerca de 1 em cada 5 pessoas (NAT restritivo/rede corporativa) não completa a chamada.
  Configure `VITE_ICE_SERVERS` com um TURN (ex.: coturn, Twilio, Cloudflare) antes de abrir para o público.
- A malha P2P é ótima até ~4–6 pessoas. Acima disso, o caminho é um SFU (LiveKit, mediasoup).

## Estrutura

```
src/
  api/         cliente HTTP único (erros, token, 401) + auth e salas
  auth/        AuthProvider, login GitHub (state anti-CSRF), RequireAuth
  realtime/    SocketProvider (1 conexão p/ o app todo), canais de sala, chat, presença
  hooks/       useRoomCall (WebRTC), useWallMessages (fila do mural)
  components/  mural, cartão de envio, grade de vídeo, chat, pessoas, convite
  pages/       Login, Register, GithubCallback, GeneralRoom, RoomsPage, RoomPage
  ui/          Button, Input, Avatar (anel degradê), Logo, Panel, Spinner
  index.css    tokens do tema (Tailwind v4 @theme)
```

## Scripts

`npm run dev` · `npm run dev:lan` · `npm run build` · `npm run preview` · `npm run lint`

## Ideias para a próxima etapa

- App nativo (Expo/React Native), reaproveitando a API como o Heat fez: `POST /api/auth/github` já aceita `redirect_uri` do app
- Compartilhamento de tela, indicador de quem está falando, reconexão automática da chamada
- Service worker (cache offline / notificações push)
