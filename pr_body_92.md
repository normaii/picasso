Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta iteração corrige o vazamento de processamento (CPU-Heavy) causado pela serialização de DOM contínua durante mutações assíncronas do UpdatePanel e aplica as rastreabilidades do Fallback Path.

## Correções acumuladas (iterações 1-27)
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
- **(Nova) Rastreabilidade no Fallback Global:** A emissão de Logs exigida na PR anterior só cobriu fluxos AJAX. O Postback Global (que limpa o documento e dispara a recriação do WebView no Electron) estava resolvendo em silêncio absoluto. Adicionada a formatação descritiva de rastreabilidade (Ex: "Operação assíncrona concluída [Custom ReadyCondition Met] após Full Postback").
- **(Nova) Coalescência de DOM Mutations (Anti-CPU-Leak):** Antes de resolver o Scraper, o sistema armazena uma "foto" em String (`.outerHTML`) do documento que falhou para permitir debug de \`table_not_found\`. Porém, a injeção disso era feita diretamente no callback principal do \`MutationObserver\`, o que significava que em relatórios massivos, CADA novo atributo gerado pelo SSRS mandava o Chromium serializar megabytes de DOM para String 500x por segundo! Otimizamos o MutationObserver para atuar apenas com um timer \`Debouncer\` e removemos a stringificação de runtime: o documento HTML só é serializado para log NO MOMENTO da explosão da falha! A CPU agradece.
