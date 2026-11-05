// But, o mascote: passeia pela página em volta da tela compartilhada, nunca por cima dela.
// Desenho em SVG, poses em CSS, deslocamento com Web Animations (nativo do navegador, roda no compositor). Sem biblioteca.
// Dá pra pegar ele com o mouse e arrastar. Para tirar: apagar este arquivo e a linha <script src="but.js"> do index.html.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const W = 84, H = 98, S = W / 120, PE = 136 * S;   // tamanho na tela; S = escala do desenho (120×140); PE = altura dos pés
  const ANDA = 0.08, CORRE = 0.3;   // px por ms
  const COMER = 2400;               // um ciclo da pipoca, igual às animações mao/milho/mastiga
  const PARA = 'para';              // motivo de interrupção: o espectador pegou o But

  // Guarda-roupa: [peça, nome, [[id, nome, variáveis CSS]]]. Formas extras ficam no desenho com a classe so-<peça>-<id>.
  const ROUPAS = [
    ['chapeu', 'Chapéu', [['bone', 'Boné'], ['gorro', 'Gorro'], ['cartola', 'Cartola'], ['festa', 'Festa'], ['nada', 'Nada']]],
    ['camisa', 'Camisa', [['moletom', 'Moletom', '--camisa:#7d1027;--gola:#f6c21b'],
      ['listrada', 'Listrada', '--camisa:url(#but-listras);--gola:#1d2d5c'],
      ['amarela', 'Amarelinha', '--camisa:#f6c21b;--gola:#1f8a3b'],
      ['nada', 'Nada', '--camisa:var(--pele)']]],
    ['calca', 'Calça', [['vinho', 'Vinho', '--perna:#7d1027'], ['jeans', 'Jeans', '--perna:#3b5b8c'], ['bermuda', 'Bermuda', '--perna:var(--pele)'], ['nada', 'Nada', '--perna:var(--pele)']]],
    ['sapato', 'Sapato', [['vinho', 'Vinho', '--sapato:#7d1027'], ['tenis', 'Tênis branco', '--sapato:#fff'], ['jordan', 'Tênis gigante'], ['nada', 'Descalço', '--sapato:var(--pele)']]],
  ];
  const PADRAO = { chapeu: 'bone', camisa: 'moletom', calca: 'vinho', sapato: 'vinho' };

  document.head.insertAdjacentHTML('beforeend', `<style>
  .but{--pele:#fbf3ea}
  .but .camisa{fill:var(--camisa)} .but .gola{stroke:var(--gola)}
  .but .perna{fill:var(--perna)} .but .pe{fill:var(--sapato)}
  .but [class^=so-]{display:none}
  .but[data-camisa=nada] .roupa,.but[data-sapato=jordan] .pe{display:none}
  /* sentado, o tênis gigante desfaz a inclinação da perna e o direito aponta pra fora, senão um cruza o outro */
  .but[data-p~=sentado] .perna-e .so-sapato-jordan{transform:translate(40px,136px) rotate(14deg) scale(1.2,1) translate(-40px,-136px)}
  .but[data-p~=sentado] .perna-d .so-sapato-jordan{transform:translate(68px,136px) rotate(-14deg) scale(-1.2,1) translate(-40px,-136px)}
  ${ROUPAS.flatMap(([s, , itens]) => itens.map(([id, , v = '']) => `.but[data-${s}=${id}]{${v}} .but[data-${s}=${id}] .so-${s}-${id}{display:inline}`)).join('\n  ')}
  .but-armario{max-width:620px;margin:auto;color:var(--tinta)}
  .but-armario::backdrop{background:rgba(20,5,9,.82)}
  .but-vitrine{display:flex;flex-wrap:wrap;gap:12px 28px;align-items:center}
  .but.but-previa{position:relative;width:150px;height:175px;margin:40px auto 0;transform:none}
  .but-previa .tudo{pointer-events:none}
  .but-pecas{flex:1;min-width:240px}
  .but-opcoes{display:flex;flex-wrap:wrap;gap:8px}
  .but-opcoes button{padding:7px 12px;font-size:13px}
  .but-opcoes button[aria-pressed=true]{background:var(--vermelho-btn);color:#fff}
  .but{position:fixed;left:0;top:0;width:${W}px;height:${H}px;z-index:5;pointer-events:none;will-change:transform}
  .but svg{width:100%;height:100%;overflow:visible;display:block}
  .but .pulo{transition:rotate .15s}
  .but.dir svg{transform:scaleX(-1)}
  .but.dir .txt{transform:scaleX(-1);transform-box:fill-box;transform-origin:center}
  /* só o desenho pega o clique, não o quadrado em volta */
  .but .tudo{transform-origin:60px 136px;transition:transform .15s;pointer-events:visiblePainted;cursor:grab;touch-action:none}
  .but-arrastando,.but-arrastando *{cursor:grabbing!important}
  .but-botao{background:none;padding:8px;border-radius:10px}
  .but-botao:hover{background:var(--vinho-alto)}
  .but-botao[aria-pressed=true] .risco{display:none}
  .but-botao[aria-pressed=false]{color:var(--apagado)}
  .but .tronco{transform-origin:60px 120px}
  .but .braco-d{transform-origin:91px 84px;transition:transform .2s}
  .but .braco-e{transform-origin:17px 82px}
  .but .perna-e{transform-origin:36px 128px}
  .but .perna-d{transform-origin:66px 128px}
  .but .pupila{transition:transform .3s}
  .but .abertos{transform-box:fill-box;transform-origin:center;animation:but-pisca 4.3s infinite}
  .but .fechados,.but .feliz,.but .riso,.but .mastiga,.but .balde,.but .milho,.but .costas,.but .palpebra{display:none}
  .but .fala{position:absolute;left:45%;bottom:92%;font:800 15px/1 'JetBrains Mono',monospace;color:#fff;white-space:nowrap;opacity:0;text-shadow:0 1px 2px #000}

  .but[data-p~=encarando] .pupila,.but[data-p~=pendurado] .pupila{transform:translate(3px,0)}
  .but[data-p~=olhando] .pupila{transform:translate(-1px,-2.5px)}
  .but[data-p~=serio] .palpebra{display:inline}

  .but[data-p~=andando] .perna-e{animation:but-passo .5s infinite}
  .but[data-p~=andando] .perna-d{animation:but-passo .5s -.25s infinite}
  .but[data-p~=andando] .tronco{animation:but-bob .25s infinite alternate}
  .but[data-p~=correndo] .perna-e{animation:but-passo .26s infinite}
  .but[data-p~=correndo] .perna-d{animation:but-passo .26s -.13s infinite}
  .but[data-p~=correndo] .tronco{animation:but-bob .13s infinite alternate}
  .but[data-p~=correndo] .tudo{transform:rotate(-9deg)}
  .but[data-p~=agachado] .tudo{transform:scale(1.12,.84)}
  .but[data-p~=pulando] .tudo{transform:scale(.92,1.08)}
  .but[data-p~=pulando] .pernas{transform:translateY(-5px)}

  .but[data-p~=sentado] .tronco{transform:translateY(16px)}
  .but[data-p~=sentado] .perna-e{transform:translate(-5px,0) rotate(-14deg)}
  .but[data-p~=sentado] .perna-d{transform:translate(5px,0) rotate(14deg)}
  .but[data-p~=dormindo] .abertos{display:none}
  .but[data-p~=dormindo] .fechados{display:inline}
  .but[data-p~=dormindo] .tudo{animation:but-respira 3s ease-in-out infinite}
  .but[data-p~=dormindo] .fala{animation:but-sobe 2.4s infinite}

  .but[data-p~=pipoca] .balde,.but[data-p~=pipoca] .milho,.but[data-p~=pipoca] .mastiga{display:inline}
  .but[data-p~=pipoca] .boca{display:none}
  .but[data-p~=pipoca] .braco-d{animation:but-mao ${COMER}ms infinite}
  .but[data-p~=pipoca] .milho{animation:but-milho ${COMER}ms infinite}
  .but[data-p~=pipoca] .mastiga{transform-box:fill-box;transform-origin:center;animation:but-mastiga ${COMER}ms infinite}

  .but[data-p~=rindo] .abertos,.but[data-p~=rindo] .boca,.but[data-p~=rindo] .mastiga,.but[data-p~=rindo] .milho{display:none}
  .but[data-p~=rindo] .feliz,.but[data-p~=rindo] .riso{display:inline}
  .but[data-p~=rindo] .braco-d{animation:none}
  .but[data-p~=rindo] .tronco{animation:but-ri .18s infinite alternate}
  .but[data-p~=sentado][data-p~=rindo] .tronco{animation-name:but-ri-sentado}

  /* de costas pra quem assiste, olhando pra cima, pra tela */
  .but[data-p~=costas] .tronco{display:none}
  .but[data-p~=costas] .so-sapato-jordan:not(.tras),.but:not([data-p~=costas]) .so-sapato-jordan.tras{display:none}
  .but[data-p~=costas] .costas{display:inline;transform-origin:53px 124px;animation:but-cima 2.6s ease-in-out infinite alternate}

  .but[data-p~=pendurado] .braco-d{transform:rotate(175deg)}
  .but[data-p~=pendurado] .tudo{transform-origin:89px 62px;animation:but-balanco 1.6s ease-in-out infinite alternate}
  .but[data-p~=pendurado] .perna-e,.but[data-p~=pego] .perna-e{transform-origin:40px 104px;animation:but-chute .35s infinite alternate}
  .but[data-p~=pendurado] .perna-d,.but[data-p~=pego] .perna-d{transform-origin:68px 104px;animation:but-chute .35s -.17s infinite alternate}
  .but[data-p~=pego] .braco-d{animation:but-agita .3s infinite alternate}
  .but[data-p~=pego] .braco-e{animation:but-agita-e .3s -.15s infinite alternate}
  .but[data-p~=batendo] .abertos{display:none}
  .but[data-p~=batendo] .fechados{display:inline}
  .but-bum{position:fixed;left:0;top:0;z-index:6;pointer-events:none;transform-origin:0 0}

  @keyframes but-pisca{0%,95%,100%{transform:none}97%{transform:scaleY(.1)}}
  @keyframes but-passo{0%,50%,100%{transform:none}25%{transform:translate(-3px,-7px)}}
  @keyframes but-bob{to{transform:translateY(-3px)}}
  @keyframes but-respira{50%{transform:scale(1.03,.97)}}
  @keyframes but-ri{from{transform:rotate(-3deg)}to{transform:rotate(3deg) translateY(-2px)}}
  @keyframes but-ri-sentado{from{transform:translateY(16px) rotate(-3deg)}to{transform:translateY(14px) rotate(3deg)}}
  @keyframes but-cima{from{transform:rotate(-1deg)}to{transform:rotate(-5deg) translateY(-2px)}}
  @keyframes but-balanco{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}
  @keyframes but-chute{from{transform:rotate(-12deg)}to{transform:rotate(12deg)}}
  @keyframes but-agita{from{transform:rotate(25deg)}to{transform:rotate(60deg)}}
  @keyframes but-agita-e{from{transform:rotate(-25deg)}to{transform:rotate(-60deg)}}
  @keyframes but-sobe{0%{opacity:0;transform:translate(-50%,6px)}25%{opacity:1}100%{opacity:0;transform:translate(-10%,-20px)}}
  /* pipoca: mexe no balde, leva até a boca, joga o milho, mastiga */
  @keyframes but-mao{0%,18%,60%,100%{transform:none}9%{transform:rotate(-8deg)}35%,45%{transform:rotate(115deg)}}
  @keyframes but-milho{0%,34%{opacity:0;transform:translate(71px,73px)}35%{opacity:1;transform:translate(71px,73px)}41%{transform:translate(60px,50px)}47%{opacity:1;transform:translate(52px,70px)}48%,100%{opacity:0;transform:translate(52px,70px)}}
  @keyframes but-mastiga{0%,40%,50%,64%,78%,92%,100%{transform:scale(1,.4)}45%{transform:scale(1.2,1.6)}57%,71%,85%{transform:none}}
  </style>`);

  // Tênis gigante de cano alto (pé esquerdo; o direito é o mesmo, deslocado). Aumentado a partir da sola, pra continuar no chão.
  const tenis = dx => `<g class="so-sapato-jordan" stroke-width="2.8" transform="translate(${dx + 40} 136) scale(1.55 1) translate(-40 -136)">
      <path d="M30 116 H50 V126 Q56 128 56 131 H10 Q10 124 19 123 L30 121Z" fill="#fff"/>
      <path d="M10 131 Q10 124 19 123 L25 122 Q28 127 24 131Z M43 116 H50 V126 Q56 128 56 131 H43Z" fill="#e01b2f" stroke="none"/>
      <path d="M30 116 H50 V126 Q56 128 56 131 H10 Q10 124 19 123 L30 121Z" fill="none"/>
      <path d="M31 124 l6 -3 M32 128 l6 -3" stroke-width="1.6"/>
      <path d="M8 130 H58 Q59 136 53 136 H13 Q7 136 8 130Z" fill="#fff"/></g>
    <g class="so-sapato-jordan tras" stroke-width="2.8" transform="translate(${dx})"><!-- de costas: o calcanhar -->
      <path d="M28 131 V118 Q28 114 32 114 H48 Q52 114 52 118 V131Z" fill="#fff"/><path d="M35 114.5 H45 V127 Q40 130 35 127Z" fill="#e01b2f"/>
      <path d="M25 130 H55 Q56 136 50 136 H30 Q24 136 25 130Z" fill="#fff"/></g>`;
  const perna = (lado, dx) => `<g class="perna-${lado}"><rect class="perna" x="${32 + dx}" y="104" width="16" height="22" rx="4"/>
      <path class="so-calca-bermuda" d="M${32 + dx} 104 h16 v14 h-16Z" fill="#c8a86b"/>
      <ellipse class="pe" cx="${36 + dx + (dx && 2)}" cy="128" rx="13" ry="8"/>${tenis(dx)}</g>`;
  const gorro = `<g class="so-chapeu-gorro"><circle cx="53" cy="-3" r="8" fill="#fbf3ea"/>
      <path d="M18 22 Q18 0 53 0 Q88 0 88 22Z" fill="#1f6f8b"/>
      <path d="M14 20 H92 V34 H14Z" fill="#17556b"/>
      <path d="M24 22 V32 M34 22 V32 M44 22 V32 M54 22 V32 M64 22 V32 M74 22 V32 M84 22 V32" stroke-width="2"/></g>`;
  const cartola = `<g class="so-chapeu-cartola">
      <rect x="22" y="-24" width="62" height="48" rx="2" fill="#2a2228"/>
      <rect x="22" y="10" width="62" height="10" fill="#e01b2f"/>
      <path d="M6 24 H100 Q104 28 100 32 H6 Q2 28 6 24Z" fill="#2a2228"/></g>`;
  const festa = (c, giro) => `<g class="so-chapeu-festa" transform="rotate(${giro} ${c} 30)">
      <path d="M${c - 20} 30 L${c} -24 L${c + 20} 30Z" fill="#e01b2f"/>
      <g fill="#f6c21b" stroke="none"><circle cx="${c - 6}" cy="20" r="3.5"/><circle cx="${c + 6}" cy="12" r="3.5"/><circle cx="${c - 2}" cy="2" r="3"/><circle cx="${c + 2}" cy="-12" r="2.5"/></g>
      <circle cx="${c}" cy="-26" r="6" fill="#f6c21b"/></g>`;

  // Desenho (olhando pra esquerda; .dir espelha). Contorno herdado do <g> de fora. Pelado é um quadrado de pele com braços e pernas.
  const desenho = () => `<svg viewBox="0 0 120 140">
  <defs><pattern id="but-listras" patternUnits="userSpaceOnUse" width="12" height="12"><rect width="12" height="12" fill="#fbf3ea"/><rect width="12" height="6" fill="#1d2d5c"/></pattern></defs>
  <g class="tudo" stroke="#1a0a0e" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <g class="pernas">${perna('e', 0)}${perna('d', 28)}</g>
    <g class="tronco">
      <g class="braco-e"><rect class="camisa" x="10" y="80" width="14" height="22" rx="7"/><circle cx="16" cy="104" r="7" fill="#fbf3ea"/></g>
      <rect class="camisa" x="20" y="28" width="66" height="84" rx="3"/>
      <path d="M22 30 H84 V76 Q53 96 22 76Z" fill="#fbf3ea" stroke="none"/>
      <g class="roupa">
        <path d="M20 74 Q53 98 86 74" fill="none"/>
        <path d="M30 80 Q53 104 76 80" fill="none" stroke-width="7"/>
        <path class="gola" d="M30 80 Q53 104 76 80" fill="none" stroke-width="3.5"/>
      </g>
      <g class="so-camisa-moletom">
        <circle cx="53" cy="100" r="9" fill="#f6c21b" stroke-width="3"/>
        <text class="txt" x="53" y="104.5" font-size="12" font-weight="800" text-anchor="middle" fill="#1a0a0e" stroke="none" font-family="sans-serif">B</text>
      </g>
      <g class="so-chapeu-bone">
        <path d="M18 32 Q18 4 54 4 Q88 4 90 30Z" fill="#7d1027"/>
        <path d="M84 22 Q104 16 110 28 Q98 32 88 31" fill="#7d1027"/>
        <text class="txt" x="52" y="25" font-size="17" font-weight="700" text-anchor="middle" fill="#fff" stroke="none" font-family="'Comic Sans MS','Segoe Print',cursive">But</text>
      </g>
      ${gorro}${cartola}${festa(58, 10)}
      <g class="abertos">
        <path d="M30 51 h17 M57 51 h17"/>
        <rect x="31" y="52" width="14" height="10" rx="5" fill="#fff" stroke-width="3"/>
        <rect x="58" y="52" width="14" height="10" rx="5" fill="#fff" stroke-width="3"/>
        <circle class="pupila" cx="34.5" cy="57" r="3.2" fill="#1a0a0e" stroke="none"/>
        <circle class="pupila" cx="61.5" cy="57" r="3.2" fill="#1a0a0e" stroke="none"/>
      </g>
      <g class="palpebra"><path d="M27 48 h23 v7.5 h-23z M54 48 h23 v7.5 h-23z" fill="#fbf3ea" stroke="none"/><path d="M30 55.5 h17 M57 55.5 h17"/></g>
      <path class="fechados" d="M31 57 q7 5 14 0 M58 57 q7 5 14 0" fill="none" stroke-width="3.5"/>
      <path class="feliz" d="M31 59 q7 -8 14 0 M58 59 q7 -8 14 0" fill="none" stroke-width="3.5"/>
      <circle cx="36" cy="66" r="2" fill="#6b4a3a" stroke="none"/>
      <path class="boca" d="M48 72 h8" stroke-width="3"/>
      <path class="riso" d="M45 68 h18 q-2 12 -9 12 q-7 0 -9 -12Z" fill="#5a0d1a" stroke-width="3"/>
      <ellipse class="mastiga" cx="52" cy="72" rx="4" ry="2.5" fill="#5a0d1a" stroke-width="2.5"/>
      <g class="braco-d"><rect class="camisa" x="84" y="80" width="14" height="24" rx="7"/><circle cx="92" cy="106" r="7" fill="#fbf3ea"/></g>
      <circle class="milho" r="4.5" fill="#fff6d8" stroke-width="2.5"/>
      <g class="balde" stroke-width="2.5">
        <circle cx="79" cy="91" r="6" fill="#fff6d8"/><circle cx="101" cy="91" r="6" fill="#fff6d8"/>
        <circle cx="87" cy="87" r="6" fill="#fff6d8"/><circle cx="95" cy="86" r="6" fill="#fff6d8"/>
        <path d="M74 94 H106 L101 120 H79Z" fill="#fff"/>
        <path d="M81 94 L84 120 M90 94 V120 M99 94 L96 120" stroke="#e01b2f" stroke-width="4" stroke-linecap="butt"/>
        <path d="M74 94 H106 L101 120 H79Z" fill="none"/>
      </g>
    </g>
    <!-- de costas: mesmo tamanho de caixa da frente -->
    <g class="costas">
      <rect class="camisa" x="6" y="80" width="14" height="22" rx="7"/><circle cx="13" cy="104" r="7" fill="#fbf3ea"/>
      <rect class="camisa" x="86" y="80" width="14" height="22" rx="7"/><circle cx="93" cy="104" r="7" fill="#fbf3ea"/>
      <rect class="camisa" x="20" y="28" width="66" height="84" rx="3"/>
      <path d="M53 93 V100 M31 96 A11 8 0 1 0 52 101 M54 101 A11 8 0 1 0 75 96" fill="none" stroke-width="3"/><!-- bundinha -->
      <path d="M22 30 H84 V66 Q53 80 22 66Z" fill="#fbf3ea" stroke="none"/>
      <g class="roupa">
        <path d="M20 64 Q53 82 86 64" fill="none"/>
        <path d="M26 68 Q53 86 80 68" fill="none" stroke-width="6.5"/>
        <path class="gola" d="M26 68 Q53 86 80 68" fill="none" stroke-width="3"/>
      </g>
      <g class="so-chapeu-bone">
        <path d="M24 22 Q6 16 0 28 Q12 32 22 31" fill="#7d1027"/>
        <path d="M18 32 Q18 4 53 4 Q88 4 88 32Z" fill="#7d1027"/>
        <path d="M42 32 Q53 15 64 32Z" fill="#fbf3ea"/>
        <path d="M43 26.5 H63" stroke-width="3"/>
        <circle cx="53" cy="4" r="3" fill="#7d1027" stroke-width="2.5"/>
      </g>
      ${gorro}${cartola}${festa(53, -10)}
    </g>
  </g></svg>`;
  document.body.insertAdjacentHTML('beforeend', `<div class="but" id="but" aria-hidden="true" hidden><div class="pulo">${desenho()}<span class="fala"></span></div></div>`);

  const el = document.getElementById('but'), pulo = el.firstElementChild, fala = el.querySelector('.fala');
  const rand = (a, b) => a + Math.random() * (b - a);
  const largura = () => document.documentElement.clientWidth;
  const chao = () => innerHeight - 6 - PE;   // y do boneco com os pés no chão da janela
  const vira = direita => el.classList.toggle('dir', direita);
  const pernas = el.querySelector('.pernas'), tronco = el.querySelector('.tronco');
  // SVG não tem z-index: sentado, as pernas vão pra depois do tronco no desenho, pra ficarem na frente dele
  const poe = (p, txt = '') => {
    el.dataset.p = p; fala.textContent = txt;
    const frente = p.includes('sentado');
    if (frente !== (pernas.previousElementSibling === tronco)) pernas.parentNode.insertBefore(pernas, frente ? tronco.nextSibling : tronco);
  };
  let pos = { x: 0, y: chao() };
  const aplica = () => el.style.transform = `translate(${pos.x}px,${pos.y}px)`;

  // Tudo que leva tempo passa por aqui: se o espectador pegar o But no meio, a ação para na hora
  let ctl = new AbortController();
  function passo(comeca) {
    const s = ctl.signal;
    return new Promise((ok, falha) => {
      if (s.aborted) return falha(PARA);
      const para = comeca(ok);
      s.addEventListener('abort', () => { para(); falha(PARA); }, { once: true });
    });
  }
  const espera = ms => passo(ok => { const t = setTimeout(ok, ms); return () => clearTimeout(t); });
  const anima = (alvo, quadros, opc) => passo(ok => { const a = alvo.animate(quadros, opc); a.onfinish = ok; return () => a.cancel(); });

  // A posição final vai direto pro style; a animação (sem fill) só cobre o caminho até lá
  function mover(x, y, ms, easing = 'linear') {
    const de = el.style.transform;
    pos = { x, y }; aplica();
    return anima(el, [{ transform: de }, { transform: el.style.transform }], { duration: ms, easing });
  }
  function salto(x, y, h, ms) {
    return Promise.all([anima(pulo, [
      { transform: 'none', easing: 'cubic-bezier(.33,.66,.66,1)' },
      { transform: `translateY(${-h}px)`, easing: 'cubic-bezier(.33,0,.66,.33)' },
      { transform: 'none' }
    ], ms), mover(x, y, ms)]);
  }
  const queda = (y, easing = 'cubic-bezier(.5,0,1,1)') => mover(pos.x, y, Math.max(150, Math.sqrt(Math.max(0, y - pos.y)) * 30), easing);

  // Moldura vermelha em volta da tela compartilhada (o ::before do .visor fica 14 px pra fora)
  function moldura() {
    const v = document.querySelector('main:not(.hidden) .visor');
    if (!v) return null;
    const r = v.getBoundingClientRect();
    return { l: r.left - 14, r: r.right + 14, t: r.top - 14, b: r.bottom + 14 };
  }
  const bate = (m, x, y) => !!m && x + W > m.l && x < m.r && y + H > m.t && y < m.b;   // o But em (x, y) ficaria por cima da tela?
  // O salto (linha reta + arco de altura h) passa longe da tela?
  function livre(m, x0, y0, x1, y1, h) {
    for (let i = 1; i < 10; i++) { const t = i / 10; if (bate(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 4 * h * t * (1 - t))) return false; }
    return true;
  }
  // Trechos do chão por onde ele pode andar: se a tela desce até o chão, sobra o lado de cada lado dela
  function zonas() {
    const m = moldura(), y = chao(), fim = largura() - W;
    const zs = m && m.b > y && m.t < y + H ? [[0, m.l - W], [m.r, fim]] : [[0, fim]];
    return zs.filter(([a, b]) => b - a > 20);
  }
  function zona() {
    const zs = zonas();
    if (!zs.length) return null;
    const dist = ([a, b]) => Math.max(a - pos.x, pos.x - b, 0);
    const z = zs.reduce((m, z) => dist(z) < dist(m) ? z : m);
    if (dist(z) || pos.y !== chao()) { pos = { x: Math.min(z[1], Math.max(z[0], pos.x)), y: chao() }; aplica(); }
    return z;
  }
  // Linhas de texto da página (fora da tela compartilhada): servem de plataforma
  function letras() {
    const linhas = [], r = document.createRange();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.data.trim() && !n.parentElement.closest('.visor,.but,.modal,script') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    for (let n; (n = w.nextNode());) { r.selectNodeContents(n); for (const q of r.getClientRects()) if (q.width > W * .5) linhas.push(q); }
    return linhas;
  }
  const praTela = () => { const m = moldura(); if (m) vira((m.l + m.r) / 2 > pos.x + W / 2); };
  const agacha = async () => { poe('agachado'); await espera(160); };
  async function ir(x) {
    const d = Math.abs(x - pos.x);
    if (d < 5) return;
    vira(x > pos.x); poe('andando');
    await mover(x, chao(), d / ANDA);
  }
  // De onde estiver (letra, moldura, mão do espectador) até o chão, sem atravessar a tela
  async function descer(cara = '') {
    const m = moldura(), fim = largura() - W;
    poe('pulando ' + cara);
    if (m && pos.x + W > m.l && pos.x < m.r && pos.y + H <= m.t + 2) {   // está em cima da tela: cai na moldura e pula pro lado
      if (pos.y < m.t - H - 2) { await queda(m.t - H); await agacha(); }
      const lados = [m.l - W - 4, m.r + 4].filter(x => x >= 0 && x <= fim).sort((a, b) => Math.abs(a - pos.x) - Math.abs(b - pos.x));
      if (lados.length) { vira(lados[0] > pos.x); poe('pulando ' + cara); await salto(lados[0], pos.y, 40, 300 + Math.abs(lados[0] - pos.x)); }
    }
    poe('pulando ' + cara); await queda(chao());
    await agacha();
  }

  /* ---------- O que ele faz ---------- */
  async function andar(z, rapido) {
    const x = rand(z[0], z[1]), d = Math.abs(x - pos.x);
    if (d < 30) return;
    vira(x > pos.x); poe(rapido ? 'correndo' : 'andando');
    await mover(x, chao(), d / (rapido ? CORRE : ANDA));
  }
  async function pular(z) {
    const x = Math.min(z[1], Math.max(z[0], pos.x + rand(-100, 100)));
    vira(x > pos.x);
    await agacha();
    poe('pulando'); await salto(x, chao(), rand(60, 120), 650);
    await agacha();
  }
  // Pula e fica pendurado num canto de baixo da moldura, balançando as pernas e encarando quem assiste
  async function agarrar(z) {
    const m = moldura();
    if (!m) return andar(z);
    const esq = Math.random() < .5;
    // a mão do braço erguido fica em (89, 62) no desenho; espelhado, em (31, 62)
    const x = esq ? m.l - 2 - 89 * S : m.r + 2 - 31 * S, y = m.b - 2 - 62 * S;
    const ax = Math.min(z[1], Math.max(z[0], esq ? x - 80 : x + 80));   // pega impulso por fora da tela; longe = está do outro lado dela
    const subida = chao() - y, noChao = n => zonas().some(([a, b]) => n >= a && n <= b);
    if (subida < 15 || subida > 360 || !noChao(x) || Math.abs(ax - x) > 120) return andar(z);
    await ir(ax);
    vira(!esq);
    await agacha();
    poe('pulando'); await salto(x, y, 50, 600);
    poe('pendurado'); await espera(rand(3000, 7000));
    await descer();
  }
  // Sobe numa linha de texto da página, anda um pouco por ela, faz alguma coisa lá em cima e desce
  async function subir(z) {
    const m = moldura(), y0 = chao(), fim = largura() - W;
    const naLinha = q => Math.min(fim, Math.max(0, rand(q.left - W * .3, q.right - W * .7)));
    for (const q of letras().sort(() => Math.random() - .5)) {
      const y = q.top + q.height * .15 - PE, x = naLinha(q);
      if (y < 0 || y0 - y < 40 || bate(m, x, y)) continue;
      const saidas = [x, m ? m.l - W - 10 : x, m ? m.r + 10 : x].map(a => Math.min(z[1], Math.max(z[0], a)));
      for (const ax of saidas) for (const h of [50, 120, 220, 340]) {
        if (!livre(m, ax, y0, x, y, h)) continue;
        await ir(ax);
        vira(x > pos.x); await agacha();
        poe('pulando'); await salto(x, y, h, 450 + (y0 - y + h) * .8);
        await agacha();
        const fx = naLinha(q);
        if (Math.abs(fx - pos.x) > 30 && !bate(m, fx, y)) { vira(fx > pos.x); poe('andando'); await mover(fx, y, Math.abs(fx - pos.x) / ANDA); }
        await [olhar, encarar, sentar, costas, rir][Math.floor(Math.random() * 5)]();
        return descer();
      }
    }
    return andar(z);
  }
  const parado = (p, a, b, txt) => { poe(p, txt); return espera(rand(a, b)); };
  const encarar = () => parado('encarando', 2500, 5000);
  const olhar = () => { praTela(); return parado('olhando', 3000, 7000); };
  const costas = () => { praTela(); return parado('costas', 4000, 9000); };
  const rir = () => { praTela(); return parado('rindo', 2500, 4500); };
  const sentar = () => { if (Math.random() < .6) praTela(); return parado(Math.random() < .5 ? 'sentado olhando' : 'sentado', 5000, 10000); };
  async function dormir() {
    await parado('sentado dormindo', 8000, 16000, 'zZ');
    await parado('sentado encarando', 900, 1500);
  }
  // Pega uma pipoca por vez; no fim de cada uma decide se continua (no mínimo duas). De vez em quando ri da tela.
  async function pipoca() {
    praTela();
    const base = Math.random() < .5 ? 'sentado ' : '';
    let n = 0;
    do {
      if (n && Math.random() < .15) await parado(base + 'pipoca rindo', 1500, 1500);
      poe(base + 'pipoca olhando'); await espera(COMER); n++;
    } while (n < 2 || Math.random() < .75);
  }
  /* ---------- Arremesso ---------- */
  const G = 0.0028, PASSA = 2;   // gravidade (px/ms²); jogado acima dessa velocidade (px/ms) ele atravessa a parede
  const SAIU = ['e', 'd', 't'];  // saiu da janela pela esquerda, direita ou teto
  let lance = [0, 0];            // velocidade do mouse ao soltar
  // Amassa contra a parede/chão: escala a partir do lado que bateu e volta
  const amassa = (origem, sx, sy) => pulo.animate([
    { transform: `scale(${sx},${sy})`, transformOrigin: origem }, { transform: 'none', transformOrigin: origem }
  ], { duration: 280, easing: 'ease-out' });
  // Voa com gravidade, quica nas paredes, teto e chão, desliza sentado até parar.
  // Resolve 'chao', 'moldura' (caiu em cima da tela) ou um de SAIU.
  const voo = (vx, vy, podePassar) => passo(ok => {
    let antes = performance.now(), id, saindo = null, deslizando = false, olhoFechado = 0;
    const acaba = r => { pulo.style.rotate = ''; ok(r); };
    // Bateu numa parede: se veio rápido, passa direto (só na primeira batida depois de jogado)
    const bateu = (lado, v) => {
      if (podePassar && Math.abs(v) > PASSA) saindo = lado;
      podePassar = false;
      return !saindo;
    };
    const quadro = agora => {
      const dt = Math.min(32, agora - antes), m = moldura(), fim = largura() - W, y0 = pos.y;
      antes = agora;
      if (!deslizando) vy += G * dt;
      pos.x += vx * dt; pos.y += vy * dt;
      if (saindo) {
        aplica();
        if (pos.x < -W * 1.5 || pos.x > fim + W * 1.5 || pos.y < -H * 1.5) return acaba(saindo);
        id = requestAnimationFrame(quadro); return;
      }
      if (pos.x < 0 && vx < 0 && bateu('e', vx)) { pos.x = 0; vx *= -.45; amassa('left center', .6, 1.15); olhoFechado = agora + 300; }
      if (pos.x > fim && vx > 0 && bateu('d', vx)) { pos.x = fim; vx *= -.45; amassa('right center', .6, 1.15); olhoFechado = agora + 300; }
      if (pos.y < 0 && vy < 0 && bateu('t', vy)) { pos.y = 0; vy *= -.4; amassa('center top', 1.15, .6); olhoFechado = agora + 300; }
      if (!saindo) {
        if (m && vy > 0 && y0 + H <= m.t && pos.y + H > m.t && pos.x + W > m.l && pos.x < m.r) {   // caiu em cima da moldura
          pos.y = m.t - H; aplica(); amassa('center bottom', 1.25, .7); return acaba('moldura');
        }
        if (pos.y > chao() && vy > 0) {
          pos.y = chao();
          if (vy > .35) { vy *= -.35; vx *= .75; amassa('center bottom', 1.3, .65); olhoFechado = agora + 200; }
          else { vy = 0; deslizando = true; }
        }
        if (deslizando) { vx *= Math.pow(.992, dt); if (Math.abs(vx) < .03) { aplica(); return acaba('chao'); } }
        const p = deslizando ? 'sentado serio' : agora < olhoFechado ? 'pego batendo' : 'pego serio';
        if (el.dataset.p !== p) poe(p);
        pulo.style.rotate = deslizando ? '' : Math.max(-30, Math.min(30, vx * 12)) + 'deg';
      }
      aplica();
      id = requestAnimationFrame(quadro);
    };
    vira(vx > 0); poe('pego serio');
    id = requestAnimationFrame(quadro);
    return () => { cancelAnimationFrame(id); pulo.style.rotate = ''; };
  });

  // Explosão: o gif cresce pra cima a partir da base, então gira pra crescer pra dentro da janela,
  // saindo da parede (ou teto) onde ele bate. Som e gif ficam ao lado do but.js.
  const GIRO = { e: 90, d: -90, t: 180, me: -90, md: 90, mt: 0, mb: 180 };   // m* = lados da moldura da tela
  function bum(x, y, lado) {
    new Audio('explosao.mp3').play().catch(() => {});
    const b = document.createElement('img');
    b.className = 'but-bum'; b.alt = '';
    b.src = 'explosao.gif?' + Date.now();   // url nova a cada vez: o gif recomeça do primeiro quadro
    // a base da explosão fica em (104, 230) no gif de 208×256
    b.style.transform = `translate(${x}px,${y}px) rotate(${GIRO[lado]}deg) translate(-104px,-230px)`;
    document.body.append(b);
    setTimeout(() => b.remove(), 1950);   // duração do gif
  }

  // Depois de solto: voa com a velocidade do mouse. Se atravessou uma parede, 2 s depois explode noutra
  // (parede, teto ou um lado da moldura da tela, menos a que entrou) e volta devagar. No fim, sai de cima da tela se parou lá e encara quem jogou, sério.
  async function cair() {
    let r = await voo(...lance, true);
    if (SAIU.includes(r)) {
      await espera(2000);
      const L = largura(), C = chao(), m = moldura(), y = rand(.15, .5) * C, x = rand(.15, .85) * (L - W);
      // [base da explosão x, y, onde ele aparece x, y, velocidade]; só os lados da moldura que têm espaço do lado de fora
      const saidas = {
        e: [0, y + H / 2, -W / 2, y, .5, -.4], d: [L, y + H / 2, L - W / 2, y, -.5, -.4], t: [x + W / 2, 0, x, -H / 2, rand(-.3, .3), .1],
      };
      if (m) {
        const my = Math.min(C, rand(m.t, m.b - H)), mx = rand(m.l, m.r - W);
        if (m.l - W >= 0) saidas.me = [m.l, my + H / 2, m.l - W, my, -.5, -.4];
        if (m.r + W <= L) saidas.md = [m.r, my + H / 2, m.r, my, .5, -.4];
        if (m.t - H >= 0) saidas.mt = [mx + W / 2, m.t, mx, m.t - H, rand(-.3, .3), -.6];
        if (m.b <= C) saidas.mb = [mx + W / 2, m.b, mx, m.b, rand(-.3, .3), .1];
      }
      const outros = Object.keys(saidas).filter(l => l !== r), lado = outros[Math.floor(Math.random() * outros.length)];
      const [bx, by, px, py, vx, vy] = saidas[lado];
      bum(bx, by, lado);
      pos = { x: px, y: py }; aplica();
      r = await voo(vx, vy, false);
    }
    if (r === 'moldura') await descer('serio');
    else if (bate(moldura(), pos.x, pos.y)) {   // parou atrás da tela: pula pro lado dela
      const [x, y] = afasta(pos.x, pos.y);
      vira(x > pos.x); poe('pulando serio');
      await salto(x, y, 40, 400);
      await descer('serio');
    }
    await parado('serio encarando', 1200, 2200);
  }

  const ACOES = [[andar, 26], [z => andar(z, true), 7], [pular, 7], [agarrar, 6], [subir, 9], [encarar, 10], [olhar, 10], [costas, 7], [rir, 7], [sentar, 7], [dormir, 4], [pipoca, 9]];
  const TOTAL = ACOES.reduce((s, [, p]) => s + p, 0);
  function sorteia() { let n = Math.random() * TOTAL; for (const [f, p] of ACOES) if ((n -= p) < 0) return f; return andar; }

  /* ---------- Pegar e arrastar ---------- */
  let preso = null, solta = null, caiu = false;
  // Ponto mais perto de (x, y) que não fica por cima da tela compartilhada
  function afasta(x, y) {
    const m = moldura(), fim = largura() - W;
    x = Math.min(fim, Math.max(0, x)); y = Math.min(chao(), Math.max(0, y));
    if (!bate(m, x, y)) return [x, y];
    const ops = [[m.l - W, y], [m.r, y], [x, m.t - H], [x, m.b]];
    const ok = ops.filter(([a, b]) => a >= 0 && a <= fim && b >= 0 && b <= chao());
    const d = ([a, b]) => Math.hypot(a - x, b - y);
    return (ok.length ? ok : ops).reduce((p, q) => d(q) < d(p) ? q : p);
  }
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || preso) return;
    e.preventDefault();
    const r = pulo.getBoundingClientRect();   // onde ele está agora, mesmo no meio de um pulo
    pos = { x: r.left, y: r.top };
    preso = new Promise(ok => solta = ok); caiu = true;
    ctl.abort(); aplica();
    const ox = e.clientX - pos.x, oy = e.clientY - pos.y;
    pulo.style.transformOrigin = `${ox}px ${oy}px`;   // balança pendurado pelo ponto onde foi pego
    poe('pego serio');
    document.documentElement.classList.add('but-arrastando');
    let antes = e.clientX, volta;
    const rastro = [[e.timeStamp, e.clientX, e.clientY]];   // últimos 100 ms do mouse, pra velocidade do arremesso
    const move = e => {
      // segurando, ele pode passar por cima da tela compartilhada; só não sai da janela
      pos = { x: Math.min(largura() - W, Math.max(0, e.clientX - ox)), y: Math.min(chao(), Math.max(0, e.clientY - oy)) }; aplica();
      pulo.style.rotate = Math.max(-35, Math.min(35, (e.clientX - antes) * 2.5)) + 'deg';
      antes = e.clientX;
      rastro.push([e.timeStamp, e.clientX, e.clientY]);
      while (rastro.length > 2 && e.timeStamp - rastro[0][0] > 100) rastro.shift();
      clearTimeout(volta); volta = setTimeout(() => pulo.style.rotate = '', 120);
    };
    const fim = e => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', fim); removeEventListener('pointercancel', fim);
      const [t0, x0, y0] = rastro[0], [t1, x1, y1] = rastro.at(-1), lim = v => Math.max(-4, Math.min(4, v));
      // mouse parado antes de soltar = só larga
      lance = e.type === 'pointerup' && e.timeStamp - t1 < 60 && t1 > t0 ? [lim((x1 - x0) / (t1 - t0)), lim((y1 - y0) / (t1 - t0))] : [0, 0];
      clearTimeout(volta); pulo.style.rotate = ''; pulo.style.transformOrigin = '';
      document.documentElement.classList.remove('but-arrastando');
      preso = null; solta();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', fim); addEventListener('pointercancel', fim);
  });

  // Botão na barra de cima para ligar/desligar o But; a escolha fica guardada neste navegador
  let ligado = true;
  try { ligado = localStorage.getItem('but') !== '0'; } catch {}
  const botao = document.createElement('button');
  botao.className = 'but-botao';
  botao.innerHTML = `<svg class="ic" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 9a7 6 0 0 1 14 0z" fill="currentColor"/><path d="M18 8.5h3"/><rect x="5" y="9" width="14" height="12" rx="1.5"/>
    <path d="M8.5 13.5h2M13.5 13.5h2M11 17.5h2"/><path class="risco" d="M3 3l18 18"/></svg>`;
  const marca = () => {
    botao.setAttribute('aria-pressed', ligado);
    botao.title = ligado ? 'Esconder o But' : 'Mostrar o But';
    botao.setAttribute('aria-label', botao.title);
  };
  botao.onclick = () => {
    ligado = !ligado; marca();
    try { localStorage.setItem('but', ligado ? '1' : '0'); } catch {}
    checa();
  };
  marca();
  // Guarda-roupa: botão do cabide na barra de cima abre a janela com o But de vitrine; a escolha fica neste navegador
  let roupa = { ...PADRAO };
  try { Object.assign(roupa, JSON.parse(localStorage.getItem('but-roupa'))); } catch {}
  const armario = document.createElement('dialog');
  armario.className = 'caixa but-armario';
  armario.setAttribute('aria-labelledby', 'butRoupaTitulo');
  armario.innerHTML = `<div class="cabeca"><h2 id="butRoupaTitulo">Roupas do But</h2><button class="but-fecha">Fechar</button></div>
    <div class="but-vitrine"><div class="but but-previa" aria-hidden="true">${desenho()}</div><div class="but-pecas">
    ${ROUPAS.map(([s, nome, itens]) => `<h3>${nome}</h3><div class="but-opcoes">${itens.map(([id, n]) => `<button data-s="${s}" data-id="${id}">${n}</button>`).join('')}</div>`).join('')}
    </div></div>`;
  document.body.append(armario);
  const veste = () => {
    for (const b of [el, armario.querySelector('.but-previa')]) Object.assign(b.dataset, roupa);
    for (const b of armario.querySelectorAll('[data-s]')) b.setAttribute('aria-pressed', roupa[b.dataset.s] === b.dataset.id);
  };
  armario.onclick = e => {
    const b = e.target.closest('button');
    if (b?.classList.contains('but-fecha')) return armario.close();
    if (!b?.dataset.s) return;
    roupa[b.dataset.s] = b.dataset.id; veste();
    try { localStorage.setItem('but-roupa', JSON.stringify(roupa)); } catch {}
  };
  veste();
  const cabide = document.createElement('button');
  cabide.className = 'but-botao';
  cabide.title = cabide.ariaLabel = 'Roupas do But';
  cabide.innerHTML = `<svg class="ic" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M10 5a2 2 0 1 1 2 2v1.5"/><path d="M12 8.5 3.4 15.2A1.5 1.5 0 0 0 4.3 18h15.4a1.5 1.5 0 0 0 .9-2.8z"/></svg>`;
  cabide.onclick = () => armario.showModal();
  document.querySelector('.direita')?.append(cabide, botao);

  // Some (e para de decidir coisas) desligado, em tela cheia ou com a aba escondida
  const visivel = () => ligado && !document.hidden && !document.fullscreenElement;
  let acordar = null;
  function checa() {
    if (!visivel()) { el.hidden = true; ctl.abort(); }   // para no meio do que estiver fazendo, pra voltar na hora
    else if (acordar) { acordar(); acordar = null; }
  }
  document.addEventListener('visibilitychange', checa);
  document.addEventListener('fullscreenchange', checa);
  addEventListener('resize', () => { if (!preso) { pos.y = chao(); aplica(); } });

  (async () => {
    const z = zona();
    if (z) { pos.x = rand(z[0], z[1]); aplica(); }
    for (;;) {
      if (!visivel()) await new Promise(r => acordar = r);
      if (preso) await preso;
      ctl = new AbortController();
      try {
        if (caiu) { caiu = false; await cair(); }
        const z = zona();
        el.hidden = !z;   // janela estreita demais: nem aparece
        if (z) { await sorteia()(z); poe(''); }
        await espera(rand(800, 2500));
      } catch (e) { if (e !== PARA) throw e; }
    }
  })();
})();
