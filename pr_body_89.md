Closes #25

## Resumo
Refatoração completa do scraper para waits reativos e assíncronos. Esta iteração corrige três falhas remanescentes de precisão apontadas pela engine do Github Copilot após intensa bateria de testes de fluxo de DOM em runtimes assíncronos.

## Correções acumuladas (iterações 1-24)
- Remoção do mutation agressivo (\`innerHTML = ''\`) que destruía o frameset SSRS.
- Captação do erro \`this world has been destroyed\` de contexto do Electron/Chromium.
- **Restauração de \`iframeState.html\` no timeout handler:** Usando o html do *nested document* para preservar rastreabilidade.
- **Otimização extrema de Turmas Vazias:** Implementação de um \`local timer\` (2 segundos) debounce resetado via mutation.
- **Handler Node.js para \`table_not_found\`:** Restabelecido de forma não-fatal permitindo "skips" puros.
- **Resolução de \`nextId\` para Semestre**
- **Limpeza de Timers Node.js e Handlers DOM em \`finally\` preventivos.**
- **Escaping de Variáveis Runtime (\`JSON.stringify()\`):** Impede Injection syntax errors vindos de options nativos com aspas.
- **Substituição do \`INVALIDATING\` tag pelo \`data-old-report\`:** Resolve o \`table_not_found\` falso positivo atrelando a extração apenas à existência física de um novo elemento gerado pelo SSRS.
- **Correção Observabilidade (Hoisting do \`foundId\`):** Variável de identificação do frame transposta para encerramentos assíncronos globais.
- **(Nova) Filtro de Extração Absoluto:** As linhas de tabela extraídas no \`tryExtract\` agora são colhidas *estritamente* do vetor de novas tabelas. Se houver layout residual misto com novo, dados legados estão hermeticamente blindados.
- **(Nova) Barreira Empty-Table Genuína:** Se a resposta do SSRS estiver completamente vazia (0 tabelas), o \`debounce\` de Turma Vazia NÃO pode armar. Um SSRS vazio é um SSRS injetando o DOM inicial; ele obrigatoriamente produzirá uma tabela. A lógica de armar timer vazio atrela-se apenas após a constatação de Tabelas Novas (sem linhas).
- **(Nova) Prevenção de Leak de Callbacks:** A atribuição \`subFrameRef\` em iframes de UpdatePanels agora invoca `removeEventListener` na referência antiga antes de assinalar a nova, blindando qualquer dupla-chamada por recriações tardias do elemento \`#report\` pelo portal.
