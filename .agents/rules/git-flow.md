# Regras de Repositório (Git Flow & Conventional Commits)

**Estas regras DEVEM ser seguidas estritamente em todas as interações neste repositório.**

## 1. Branching Model (Obrigatório)
- **NUNCA** faça commits diretamente nas branches `master`, `release` ou `develop`.
- **SEMPRE** crie uma branch a partir da `develop` para trabalhar em uma issue.
- O formato do nome da branch deve ser: `feature/PIC-<numero>-<descricao-curta>`.
- Ao criar um Pull Request, a branch de destino (base) **DEVE SER OBRIGATORIAMENTE** a `develop`.

## 2. Conventional Commits (Obrigatório)
- Todos os commits devem seguir a especificação de Conventional Commits.
- Formato: `<tipo>(<escopo>): <mensagem em português>`.
- Tipos válidos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`.
- O escopo deve conter a tag da issue (ex: `PIC-2`).
- Exemplo válido: `feat(PIC-2): parametrizacao do nome da escola`.

## 3. Pull Requests
- Toda PR criada via terminal (ex: `gh pr create`) deve incluir explicitamente a base correta (`--base develop`). O GitHub assume `master` como padrão, mas nossa CI barrará a PR se isso acontecer.
- Enriqueça a descrição da PR detalhando as alterações e citando a Issue relacionada.

## 4. Documentação Pública (README)
- SEMPRE revise o `README.md` após concluir uma implementação.
- Verifique se as alterações arquiteturais ou de interface criaram a necessidade de atualizar instruções, pré-requisitos ou comandos.
- O README é a porta de entrada do usuário final; nunca deixe a documentação ficar obsoleta em relação ao código.

## 5. Ciclo de Vida da Tarefa (GitHub Projects)
**O Agente Executor tem a responsabilidade de garantir (ou solicitar) que o card da Issue acompanhe a fase correta no board:**
- **To Refine**: Tarefa recém-criada, sem plano.
- **In Refinement**: Durante a discussão de regras de negócio.
- **Tech Refinement**: Criação do ADR (`docs/ADR/PIC-X.md`) e planejamento técnico.
- **Backlog**: Plano aceito pelo usuário. Pronta para execução.
- **In Progress**: Execução iniciada (branch criada). **NOTA**: A tarefa permanece em `In Progress` durante toda a criação da PR e revisões (mesmo com solicitações de mudança).
- **QA**: **SOMENTE** após a PR ser mergeada na branch `develop` (via automação ou manualmente).

Se o agente não tiver permissões ou IDs do GraphQL para mover o card via CLI, ele **DEVE** informar ao usuário o status atual em que o card deveria estar e pedir explicitamente para o usuário movê-lo no painel.

## 6. Consulta Rápida
Se tiver dúvidas sobre o processo completo (como draft releases e rc), consulte o documento oficial de arquitetura em `docs/ADR/PIC-1.md`.


