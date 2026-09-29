Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta iteração aborda uma mitigação de risco de `Stale Data` em Dropdowns Dependentes (cascatas de filtros do ASP.NET) alertada pelo Reviewer, finalizando as refatorações.

## Correções acumuladas (iterações 1-30)
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
- Proteção contra Stale Data (`endRequestHandler Guard`).
- **Mitigação de `Stale Data` em Dropdowns Dependentes:** A IA de revisão informou um apontamento consultivo (não-bloqueante) na PR #94: o Scraper ainda continha um risco de `Stale Data` nas cascatas de dropdowns do ASP.NET. Quando disparávamos o `change` em uma caixa (ex: Região) e passávamos um `readyCondition` para o Scraper ler se a próxima caixa (ex: Município) havia sido populada, isso era um falso-positivo caso o `Município` JÁ possuísse *options* de um carregamento prévio. O Scraper interpretava as *options* velhas como "sucesso", prosseguindo prematuramente sem esperar o ASP.NET trazer os municípios da NOVA região. Para arrumar isso, em todas as injeções de seletores em cascata (`setupState` e `SELECT_SEMESTRE`), o Scraper agora destroi o innerHTML da PRÓXIMA caixa (`nextEl.innerHTML = ''`) imediatamente antes de disparar o `change`. Isso força o `readyCond` a falhar e aguardar verdadeiramente até que a resposta do servidor popule novamente o alvo!
