Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Essa iteração atende ao grau de sofisticação máximo exigido pelo CR, isolando comportamentos dependentes de formulários WebForms.

## Correções acumuladas (iterações 1-15)
- Remoção do mutation agressivo (\`innerHTML = ''\`) que destruía o frameset SSRS; uso de \`INVALIDATING\` tag.
- Invalidação propagada profundamente para iframes aninhados.
- Captação do erro \`this world has been destroyed\` de contexto do Electron/Chromium no fallback.
- Injeção direta de \`load listener\` no sub-frame \`report\` (quebrando as fronteiras limitantes de iframes aninhados).
- Restauração de \`iframeState.html\` no timeout handler usando html do *nested document* para preservar rastreabilidade real em \`debug_report_iframe.html\`.
- **(Nova)** Otimização extrema de Turmas Vazias: Implementação de um \`local timer\` (2 segundos curtos) que resolve "empty tables" após a página parar de mutacionar, poupando 60 segundos inteiros por turma em colégios muito vazios.
- Handler de Node.js restaurado de forma não-fatal para \`table_not_found\` permitindo que turmas vazias sejam apenas logadas e "skipped".
- **(Nova)** Resolução de dependências \`nextId\` para Semestre, resolvendo a race-condition entre a seleção de Ano e o dropdown de Semestre.
- Correção de bugs de sintaxe provocados por escape de templates literals em runtime.
- Limpeza sistemática de Node.js Timers em \`finally\` preventivos.
