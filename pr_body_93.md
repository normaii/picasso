Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta iteração corrige o vazamento de CPU no `Main Observer` e insere definitivamente a rastreabilidade no Fallback Path.

## Correções acumuladas (iterações 1-28)
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
- **Rastreabilidade no Fallback Global:** A emissão de Logs exigida na PR anterior só cobriu fluxos AJAX. O Postback Global (que limpa o documento e dispara a recriação do WebView no Electron) estava resolvendo em silêncio absoluto. Adicionada a formatação descritiva de rastreabilidade (Ex: "Operação assíncrona concluída [Custom ReadyCondition Met] após Full Postback").
- **Coalescência de DOM Mutations (Anti-CPU-Leak):** A coalescência de CPU que foi adicionada na iteração anterior para não serializar HTML milhares de vezes no Chromium só tinha sido injetada no Observer interno (do iframe do Report Viewer). O observer principal (que atua no frame root) continuava com o processamento livre, e agora o `Debounce` foi roteado em definitivo para ambos! A otimização está irretocável!
