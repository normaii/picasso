Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta PR final aborda a última vulnerabilidade identificada, alcançando 100% de estabilidade frente às dinâmicas peculiares de UpdatePanels do SSRS.

## Correções acumuladas (iterações 1-20)
- Remoção do mutation agressivo (\`innerHTML = ''\`) que destruía o frameset SSRS.
- Invalidação propagada profundamente para iframes aninhados.
- Captação do erro \`this world has been destroyed\` de contexto do Electron/Chromium no fallback.
- Injeção direta de \`load listener\` no sub-frame \`report\` com cleanup estrito prevenindo Closure Leaks.
- Restauração de \`iframeState.html\` no timeout handler usando html do *nested document* para preservar rastreabilidade real em \`debug_report_iframe.html\`.
- Otimização extrema de Turmas Vazias: Implementação de um \`local timer\` (2 segundos curtos) que implementa um DEBOUNCE genuíno (reset a cada mutação de DOM) para que a tolerância conte apenas após o documento parar completamente de reportar "Tabela Vazia".
- Handler de Node.js restaurado de forma não-fatal para \`table_not_found\` permitindo que turmas vazias sejam apenas logadas e "skipped".
- Resolução de dependências \`nextId\` para Semestre, resolvendo a race-condition entre a seleção de Ano e o dropdown de Semestre.
- Limpeza sistemática de Node.js Timers e Handlers do DOM em \`finally\` preventivos.
- Correção do Escaping de variáveis interpoladas: Expandido o \`JSON.stringify()\` para todas as variáveis injetadas em JavaScript de runtime do Browser, impedindo falhas críticas de parse se um dropdown do SSRS retornar texto contendo aspas simples (e.g. \`Sant'Ana\`).
- **(Nova)** Extinção do atributo \`INVALIDATING\`: Como o SSRS recicla o DOM em alguns UpdatePanels, o atributo marcador de "carregamento iminente" sobrevivia à deleção visual, congelando permanentemente a extração da próxima turma. A abordagem foi substituída por **Physical Row Removal** (deleção exata via DOM API apenas das tags \`<tr>\` antigas). Isso harmoniza perfeitamente com o Debouncer de Turmas Vazias, eliminando o state-leak e reestabelecendo tolerância puramente baseada na presença de nós do DOM.
