# Regras de Workflow de Desenvolvimento (Picasso)

Esta regra é **ABSOLUTA** e está gravada em pedra para este e todos os projetos futuros. Nenhuma iteração de IA deve desviar destas diretrizes.

## 1. Branch Única por Tarefa (Retroreferencialidade)
- **REGRA DE OURO:** Todo o ciclo de desenvolvimento de uma tarefa **DEVE** ocorrer em uma **ÚNICA** branch.
- Essa branch deve conter a referência da chave da tarefa (ex: `feature/PIC-13-nome-da-feature`).
- **NUNCA** crie ramificações sucessivas (`-v2`, `-v3`, `-v10`) para a mesma tarefa apenas para tentar forçar aprovações ou re-reviews.
- Isso preserva o histórico do Git limpo e centralizado, mantendo o contexto íntegro atrelado à issue original.

## 2. Ciclo de Revisão e Autonomia (Copilot Code Review)
- O fluxo de avaliação de Pull Requests pelo Copilot Code Review não pode ser re-iniciado com marcações (`@copilot review`) se a Action estiver bloqueada/engessando.
- **Se o Copilot apontar erros (Findings) na revisão:**
  1. A Pull Request atual **deve ser fechada** (REJEITADA).
  2. As correções devem ser feitas localmente e commitadas na **MESMA branch de desenvolvimento**.
  3. Uma **NOVA Pull Request** deve ser aberta a partir da **MESMA branch**.
  4. Aguarde a nova validação automática do `Running Copilot Code Review` ser engatilhada por essa nova abertura.
- Repita o processo iterativamente (mesma branch -> fechar PR -> corrigir -> abrir PR) infinitamente até que a avaliação retorne `Approved`.

## 3. Práticas de Código e Análise Prévia
- Antes de agir e executar os comandos finais, você **DEVE** escrever em CAIXA ALTA (Caps Lock) no plano mental (ou na mensagem) exatamente o que vai fazer.
- Explicitar a verificação da branch correta, a revisão atenta das issues abertas e a lógica das correções.
- Jamais tome decisões que quebrem os princípios de isolamento de responsabilidades definidos nos ADRs do projeto.

---
**NÃO SEJA RELAPSO. LEIA E REVISE TUDO ANTES DE FAZER.**
