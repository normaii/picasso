# ADR: PIC-28 - Mitigação de XSS e Validação nas Configurações

## 1. Contexto

Durante a revisão da Pull Request da PIC-2, foi identificada uma vulnerabilidade em potencial de Cross-Site Scripting (XSS). As configurações inseridas no painel de administração (`escolaNome` e `escolaLogo`) estavam sendo injetadas diretamente como string no template HTML do gerador de PDF (`pdfGenerator.js`) usando a função `String.replace()`. Além disso, a rota da API Express não estava aplicando validações nem requerendo obrigatoriedade do nome da escola.

Se um texto malicioso como `<script>alert('xss')</script>` ou atributos de imagem como `" onerror="alert(1)` fossem enviados para o banco, isso poderia causar uma falha na renderização do Chromium *headless* no momento da emissão das carteirinhas.

## 2. Decisão

- Criar um módulo utilitário de segurança (`src/utils/security.js`) com a função `escapeHtml()`, responsável por converter caracteres especiais (`<, >, &, ", '`) em `HTML Entities`.
- Implementar a função `validateLogoUrl()` para evitar pseudo-protocolos como `javascript:` na inserção da logomarca.
- Na API (`src/api/routes.js`), validar o tipo e o campo `escolaNome` (trim) para impedir strings vazias ou nulas, e garantir que apenas strings sejam salvas. Se for inválido, retornar HTTP 400 Bad Request.
- **Sanitização no Output (Escape on Output)**: A sanitização (`escapeHtml`) não deve ocorrer na persistência do banco de dados, para evitar *double HTML encoding*. O escape será aplicado **apenas** dentro do `pdfGenerator.js`, logo antes da interpolação `replace()` final, em campos configuráveis e vitais como `escolaNome`, `logoUrl`, `nome`, `matricula` e `turma_nome`. Essa abordagem mantém a integridade dos dados puros no banco e protege a geração do PDF contra *code injection*.

## 3. Consequências

- Segurança fortalecida na manipulação de configurações globais.
- Proteção nativa no *headless browser* contra quebra de layout ou *code injection* durante a geração de carteirinhas.
- O campo `escolaNome` agora é estritamente obrigatório.
