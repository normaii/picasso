Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Essa iteração atende ao grau de sofisticação máximo exigido pelo CR, isolando comportamentos dependentes de formulários WebForms e garantindo total estanqueidade de estados de timers globais.

## Correções acumuladas (iterações 1-17)
- Remoção do mutation agressivo (\`innerHTML = ''\`) que destruía o frameset SSRS; uso de \`INVALIDATING\` tag.
- Invalidação propagada profundamente para iframes aninhados.
- Captação do erro \`this world has been destroyed\` de contexto do Electron/Chromium no fallback.
- Injeção direta de \`load listener\` no sub-frame \`report\` com cleanup estrito prevenindo Closure Leaks.
- Restauração de \`iframeState.html\` no timeout handler usando html do *nested document* para preservar rastreabilidade real em \`debug_report_iframe.html\`.
- Otimização extrema de Turmas Vazias: Implementação de um \`local timer\` (2 segundos curtos) que implementa um DEBOUNCE genuíno (reset a cada mutação de DOM) para que a tolerância conte apenas após o documento parar completamente de reportar "Tabela Vazia".
- Handler de Node.js restaurado de forma não-fatal para \`table_not_found\` permitindo que turmas vazias sejam apenas logadas e "skipped".
- Resolução de dependências \`nextId\` para Semestre, resolvendo a race-condition entre a seleção de Ano e o dropdown de Semestre.
- Limpeza sistemática de Node.js Timers e Handlers do DOM em \`finally\` preventivos.
