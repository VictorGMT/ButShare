# ButShare

Compartilhar a tela com os amigos, com qualidade e sem o áudio do Discord.

- **Site:** https://victorgmt.github.io/tela (dá para compartilhar e assistir pelo navegador)
- **App para Windows:** página de [Releases](https://github.com/VictorGMT/tela/releases). Baixe **só daqui**.

## Como funciona

- O vídeo vai **direto** do PC de quem compartilha para o PC de quem assiste (WebRTC), criptografado de ponta a ponta.
- O servidor gratuito do [PeerJS](https://peerjs.com) só apresenta um PC ao outro; ele não vê a tela.
- O app (Electron) carrega a interface do site, então mudanças no `index.html` chegam para todos sem reinstalar.
- `audiocap/` é um programinha em C++ que captura o áudio do PC **menos o Discord** (Windows 10 2004+).
- `discord.js` mostra "Compartilhando a tela" no perfil do Discord. **Sem o link da sala**: o status é público.

## Segurança (não remover)

- O app nega microfone, câmera, localização, notificações etc. (`travarPermissoes` em `main.js`).
- Captura de tela, miniaturas das janelas e áudio do PC só funcionam logo depois de um **clique real** da pessoa,
  e cada escolha vale para uma captura só.
- Links que a página tenta abrir só saem se forem `https://`.
- A biblioteca de conexão (`peerjs.min.js`) fica no repositório, sem depender de site de terceiros.
- A conta do GitHub controla o site **e** as atualizações do app: mantenha a verificação em duas etapas ligada.

## Lançar uma versão nova do app

Só precisa quando muda `main.js`, `preload.js`, `discord.js` ou o `audiocap`. Mudanças só no `index.html` não precisam.

1. Suba o número em `package.json` (`"version"`). **Sem isso o aviso de atualização não aparece.**
2. `npm install`
3. `npm test`
4. `npm run audiocap` (precisa do `x86_64-w64-mingw32-g++`)
5. `npm run dist` (no Linux, precisa do Wine com 32 bits)
6. Instale `dist/ButShare-Setup.exe` e teste: compartilhar, trocar tela, áudio.
7. No GitHub: **Releases → Draft a new release**, tag `vX.Y.Z`, envie `ButShare-Setup.exe`,
   `ButShare-Setup.exe.blockmap` e `latest.yml`, e publique.

## Diagnóstico

Se alguém não conseguir conectar, peça para abrir https://victorgmt.github.io/tela/diag.html e mandar um print.
