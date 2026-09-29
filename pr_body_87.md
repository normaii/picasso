Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta iteração abrange o vazamento de rastreabilidade de logs no `global timeout`, garantindo total visibilidade em falhas de timeout que esgotam o timer global.

## Correções acumuladas (iterações 1-22)
- Remoção do mutation agressivo (\`innerHTML = ''\`) que destruía o frameset SSRS.
- Captação do erro \`this world has been destroyed\` de contexto do Electron/Chromium no fallback.
- Injeção direta de \`load listener\` no sub-frame \`report\` com cleanup estrito prevenindo Closure Leaks.
- Restauração de \`iframeState.html\` no timeout handler usando html do *nested document* para preservar rastreabilidade.
- Otimização extrema de Turmas Vazias: Implementação de um \`local timer\` (2 segundos curtos) que implementa um DEBOUNCE genuíno (reset a cada mutação de DOM) para que a tolerância conte apenas após o documento parar completamente de reportar "Tabela Vazia".
- Handler de Node.js restaurado de forma não-fatal para \`table_not_found\` permitindo que turmas vazias sejam apenas logadas e "skipped".
- Resolução de dependências \`nextId\` para Semestre.
- Limpeza sistemática de Node.js Timers e Handlers do DOM em \`finally\` preventivos.
- Correção do Escaping de variáveis interpoladas com \`JSON.stringify()\` mitigando vulnerabilidades de parse em runtimes do Chromium.
- Extinção do atributo \`INVALIDATING\` em prol do Physical Row Removal, garantindo isolamento total de estado entre relatórios no mesmo painel AJAX.
- Inclusão do identificador de iframe (\`foundId\`) no log do Debouncer de Turmas Vazias.
- **(Nova)** Hasteamento (Hoisting) da variável \`foundId\` para os callbacks atrelados ao timeout principal (60 segundos). O Copilot alertou que, embora o Debouncer local emitisse o id correto, se um painel ficasse travado a ponto de o Timer Global agir e a turma fosse marcada como \`table_not_found\`, a ausência do ID no closure do Timer principal corromperia as mensagens de log (mostrando vazio). Corrigido via variável extra \`lastFoundId\` no head scope da Promise!
