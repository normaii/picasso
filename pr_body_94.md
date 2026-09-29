Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta iteração corrige o avanço prematuro do estado provocado pela ausência de `Guard Clause` (`!sawBeginRequest`) no callback do `endRequest` do ASP.NET.

## Correções acumuladas (iterações 1-29)
- Remoção do mutation agressivo (\`innerHTML = ''\`) que destruía o frameset SSRS.
- Captação do erro \`this world has been destroyed\` de contexto do Electron/Chromium.
- Restauração de \`iframeState.html\` no timeout handler.
- Otimização extrema de Turmas Vazias (Debounce) e Handler Node.js.
- Resolução de \`nextId\` para Semestre e Limpeza de Timers Node.js.
- Escaping de Variáveis Runtime (\`JSON.stringify()\`).
- Substituição do \`INVALIDATING\` tag pelo \`data-old-report\`.
- Correção Observabilidade (Hoisting do \`foundId\`).
- Filtro de Extração Absoluto por tabelas exclusivas do AJAX e Prevenção de Leak de Callbacks no listener de \`load\`.
- Barreira Empty-Table Genuína barrando DOM zerado de disparar "Turma Vazia" prematuramente.
- Deduplicação Estrutural de Linhas Extraídas (Set memory deduplication).
- Rastreabilidade Condicional de Logs (ADR PIC-13).
- Rastreabilidade no Fallback Global.
- Coalescência de DOM Mutations (Anti-CPU-Leak).
- **Proteção contra Stale Data (`endRequestHandler Guard`):** O Copilot sinalizou uma vulnerabilidade sutil! Na PR anterior, havíamos adicionado o bloqueio de "stale request" (`hasAction && hasPRM && !sawBeginRequest`) para o *MutationObserver*, impedindo-o de detectar DOM "pronto" de antigas requisições se a requisição atual ainda nem foi enviada para o ASP.NET. Porém, esquecemos de colocar o mesmo bloqueio de "stale" para o próprio evento nativo do SSRS, o `endRequest`. Em cenários de alta latência, requisições antigas em voo do ASP.NET ativavam o `endRequest`, enganando o código e fazendo a máquina de estado ler relatórios do ciclo anterior! Agora, os dois listeners estão com o Gate de Proteção blindado.
