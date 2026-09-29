Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta iteração corrige a última redundância sintática identificada na raspagem de tabelas aninhadas.

## Correções acumuladas (iterações 1-25)
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
- **(Nova) Deduplicação Estrutural de Linhas Extraídas:** O SSRS utiliza infames tabelas aninhadas para manter o layout no ASP.NET. Quando passamos a mapear a existência de Novas Tabelas e extrair de dentro delas, uma query \`querySelectorAll('tr')\` sendo executada em tabela "Pai" e tabela "Filha" capturava a mesma linha contendo o aluno DUAS vezes (uma via descendência, e outra diretamente). Como nós iterávamos nas tabelas fazendo \`flatMap\`, um mesmo estudante era extraído e inserido duas vezes no pipeline (gerando upserts redundantes pesadíssimos no banco Postgres remoto). Corrigido via deduplicação por \`Set\` nas referências aos nós do DOM recém-minerados!
