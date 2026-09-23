# PIC-33: Correção da Automação ChatOps (/aprovado)

## Status
Aceito (Fase de Planejamento)

## Contexto
Durante o ciclo de desenvolvimento, implementamos uma automação via GitHub Actions (`chatops.yml`) para permitir que revisores aprovem e façam o merge automático de uma Pull Request digitando `/aprovado` nos comentários.
Entretanto, a Action nunca foi engatilhada, falhando silenciosamente e exigindo merges manuais sucessivos.
A investigação revelou dois pontos de falha:
1. **Comportamento do GitHub Actions:** O gatilho `issue_comment` requer obrigatoriamente que o arquivo YAML do workflow exista na *branch default* do repositório (`master`). Atualmente, ele só existe nas branches de desenvolvimento (`develop` e `feature/*`).
2. **Escopo de Permissões:** O script tentava utilizar o `GITHUB_TOKEN` padrão para executar o comando `gh pr merge`. Em repositórios modernos, esse token é *Read-Only* por padrão durante eventos de `issue_comment`, resultando em "Permission Denied" mesmo se o gatilho fosse acionado.

## Decisão
Foi decidido corrigir o código na fonte de desenvolvimento atual, aceitando que a funcionalidade só estará disponível após o ciclo completo de release. As ações tomadas serão:
1. **Adição de Permissões Explícitas:** Atualizar o arquivo `.github/workflows/chatops.yml` na branch `develop` para incluir o bloco de `permissions` com `pull-requests: write` e `contents: write`.
2. **Sincronização Passiva:** Ao invés de forçar um hotfix direto na `master` ou alterar a *Default Branch* do projeto nas configurações do GitHub, a correção será mesclada na `develop` e seguirá o fluxo normal de desenvolvimento (GitFlow): da `develop` para uma branch de `release`, e finalmente para a `master`.
3. **Paciência Operacional:** A Issue correspondente (#33) será marcada para fechamento condicional, amarrando a sua resolução à subida de versão para a `master`.

## Consequências
- A automação `/aprovado` continuará indisponível durante o atual ciclo de desenvolvimento na `develop`.
- Os merges de Pull Requests de feature continuarão sendo feitos manualmente na interface do GitHub até a próxima release.
- Evitamos a "poluição" da `master` com workflows de infraestrutura fora de um pacote de release formal, respeitando rigorosamente o GitFlow.
- Quando o próximo Release for fechado, o ChatOps passará a funcionar de maneira transparente para todas as PRs futuras.
