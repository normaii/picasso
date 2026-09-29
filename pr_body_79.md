Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Essa iteração trata os últimos edge-cases mais obscuros de boundaries de iframe e crashes do motor Chromium.

## Correções acumuladas (iterações 1-14)
- Remoção do mutation agressivo (\`innerHTML = ''\`) que destruía o frameset SSRS; uso de \`INVALIDATING\` tag.
- Invalidação propagada profundamente para iframes aninhados.
- Captação do erro \`this world has been destroyed\` de contexto do Electron/Chromium no fallback.
- Injeção direta de \`load listener\` no sub-frame \`report\` (quebrando as fronteiras limitantes de iframes aninhados).
- Restauração de \`iframeState.html\` no timeout handler usando html do *nested document* para preservar rastreabilidade real em \`debug_report_iframe.html\`.
- Reversão inteligente de Early-Returns para preservação do Timeout Observer de turmas vazias (Conforme recomendação do CR).
- Handler de Node.js restaurado de forma não-fatal para \`table_not_found\` permitindo que turmas vazias sejam apenas logadas e "skipped".
- Correção de bugs de sintaxe provocados por escape de templates literals em runtime.
- Limpeza sistemática de Node.js Timers em \`finally\` preventivos.
