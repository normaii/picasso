Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta iteração corrige uma intrincada "race condition" na identificação de turmas vazias pelo Debouncer em cenários de alta latência (rede lenta).

## Correções acumuladas (iterações 1-23)
- Remoção do mutation agressivo (\`innerHTML = ''\`) que destruía o frameset SSRS.
- Captação do erro \`this world has been destroyed\` de contexto do Electron/Chromium no fallback.
- Injeção direta de \`load listener\` no sub-frame \`report\` com cleanup estrito prevenindo Closure Leaks.
- Restauração de \`iframeState.html\` no timeout handler usando html do *nested document* para preservar rastreabilidade.
- Otimização extrema de Turmas Vazias: Implementação de um \`local timer\` (2 segundos curtos) que implementa um DEBOUNCE genuíno (reset a cada mutação de DOM) para que a tolerância conte apenas após o documento parar completamente de reportar "Tabela Vazia".
- Handler de Node.js restaurado de forma não-fatal para \`table_not_found\` permitindo que turmas vazias sejam apenas logadas e "skipped".
- Resolução de dependências \`nextId\` para Semestre.
- Limpeza sistemática de Node.js Timers e Handlers do DOM em \`finally\` preventivos.
- Correção do Escaping de variáveis interpoladas com \`JSON.stringify()\` mitigando vulnerabilidades de parse em runtimes do Chromium.
- Extinção do atributo \`INVALIDATING\` (State Leak do body)
- Inclusão do identificador de iframe (\`foundId\`) no log do Debouncer de Turmas Vazias e Hasteamento (Hoisting) da variável para o global timeout scope.
- **(Nova)** Substituição do Physical Row Removal pela marcação **\`data-old-report\`**. O Copilot identificou que apagar fisicamente as linhas causava uma Race Condition se o AJAX do ASP.NET atrasasse mais de 2 segundos para disparar a tela de loading. Ao zerar as linhas, as gates consideravam o relatório "antigo" como um "novo relatório vazio" e ativavam prematuramente o cancelamento da turma antes mesmo de a requisição sair. Substituído por marcação \`data-old-report="true"\` nas tabelas antigas, com uma nova barreira \`hasNewTables\` que atrela matematicamente a extração da nova turma à injeção física de um novo nó DOM pelo UpdatePanel.
