Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta iteração corrige uma falha menor de observabilidade/log identificada na exclusão de turmas vazias pelo Debouncer.

## Correções acumuladas (iterações 1-21)
- Remoção do mutation agressivo (\`innerHTML = ''\`) que destruía o frameset SSRS.
- Captação do erro \`this world has been destroyed\` de contexto do Electron/Chromium no fallback.
- Injeção direta de \`load listener\` no sub-frame \`report\` com cleanup estrito prevenindo Closure Leaks.
- Restauração de \`iframeState.html\` no timeout handler usando html do *nested document* para preservar rastreabilidade.
- **Otimização extrema de Turmas Vazias:** Implementação de um \`local timer\` (2 segundos curtos) que implementa um DEBOUNCE genuíno (reset a cada mutação de DOM) para que a tolerância conte apenas após o documento parar completamente de reportar "Tabela Vazia".
- Handler de Node.js restaurado de forma não-fatal para \`table_not_found\` permitindo que turmas vazias sejam apenas logadas e "skipped".
- Resolução de dependências \`nextId\` para Semestre.
- Limpeza sistemática de Node.js Timers e Handlers do DOM em \`finally\` preventivos.
- **Correção do Escaping de variáveis interpoladas:** Expandido o \`JSON.stringify()\` para TODAS as variáveis injetadas em JavaScript de runtime do Browser, impedindo falhas críticas de parse de aspas simples oriundas do SSRS.
- **Extinção do atributo \`INVALIDATING\`:** Substituída por DOM Physical Row Removal para eliminar o state-leak de turmas engatilhadas em UpdatePanels parciais do SSRS.
- **(Nova)** Correção de Observabilidade: O identificador de iframe (`foundId`) foi anexado ao payload de retorno do debouncer de Turma Vazia, reestabelecendo a identificação do nó no terminal e log do Electron.
