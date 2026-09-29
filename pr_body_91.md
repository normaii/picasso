Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta iteração corrige a última não-conformidade documental remanescente referente à ADR PIC-13 (Observabilidade de Listeners).

## Correções acumuladas (iterações 1-26)
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
- **(Nova) Rastreabilidade Condicional de Logs:** O Copilot cruzou nossa implementação com o arquivo `docs/ADR/PIC-13.md` (Architecture Decision Record) e identificou que o contrato exigia que nós logássemos exatamente "qual foi a condição de DOM que destravou o Waiter" ao concluir uma espera com sucesso. A função genérica apenas informava `[Scraper-DOM] Operação concluída`. Adicionamos um rastreador em tempo de retorno no loop do `checkReady()` que transporta a string exata (`Custom ReadyCondition Met` ou `Default ASP.NET Ready`) e interpola no terminal de forma descritiva!
