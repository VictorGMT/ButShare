# ButShare

Compartilhar a tela com os amigos, com qualidade e sem o áudio do Discord.

- **Site:** https://victorgmt.github.io/ButShare (dá para compartilhar e assistir pelo navegador)
- **App para Windows e Linux:** página de [Releases](https://github.com/VictorGMT/ButShare/releases). Baixe **só daqui**.

## Como funciona

- O vídeo vai **direto** do PC de quem compartilha para o PC de quem assiste (WebRTC), criptografado de ponta a ponta.
- O servidor gratuito do [PeerJS](https://peerjs.com) só apresenta um PC ao outro; ele não vê a tela.
- O app (Electron) carrega a interface do site, então mudanças no `index.html` chegam para todos sem reinstalar.
- `audiocap/` é um programinha em C++ que captura o áudio do PC **menos o Discord** (Windows 10 2004+).
  No Linux quem faz isso é o `audiolinux.js`, com o PipeWire (`pw-record` + `pw-link`).
- `discord.js` mostra "Compartilhando a tela" no perfil do Discord. **Sem o link da sala**: o status é público.

## Segurança (não remover)

- O app nega microfone, câmera, localização, notificações etc. (`travarPermissoes` em `main.js`).
- Captura de tela, miniaturas das janelas e áudio do PC só funcionam logo depois de um **clique real** da pessoa,
  e cada escolha vale para uma captura só.
- Links que a página tenta abrir só saem se forem `https://`.
- A biblioteca de conexão (`peerjs.min.js`) fica no repositório, sem depender de site de terceiros.
- A conta do GitHub controla o site **e** as atualizações do app: mantenha a verificação em duas etapas ligada.

## Lançar uma versão nova do app

Só precisa quando muda `main.js`, `preload.js`, `discord.js`, `audiolinux.js` ou o `audiocap`. Mudanças só no `index.html` não precisam.

1. Suba o número em `package.json` (`"version"`) e rode `npm install`. **Sem isso o aviso de atualização não aparece.**
2. Teste com `npm start` (abre o `index.html` da pasta): compartilhar, trocar tela, áudio.
3. Faça o commit e o push, e mande a tag com as novidades (vira o texto do Release):
   `git tag -a vX.Y.Z -m "o que mudou"` e `git push origin vX.Y.Z`
4. O GitHub Actions (`.github/workflows/release.yml`) gera o instalador do Windows e o AppImage
   e publica o Release com `ButShare-Setup.exe`, `.blockmap`, `latest.yml`, `ButShare.AppImage` e `latest-linux.yml`.
   Acompanhe na aba **Actions** do repositório.

Para gerar à mão: `npm run audiocap` (precisa do `x86_64-w64-mingw32-g++`), `npm run dist` (no Linux, precisa do Wine) e `npm run dist:linux`.

## Diagnóstico

Se alguém não conseguir conectar, peça para abrir https://victorgmt.github.io/ButShare/diag.html e mandar um print.
