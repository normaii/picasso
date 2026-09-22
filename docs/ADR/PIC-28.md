# ADR: PIC-28 - Mitigação de XSS e Validação nas Configurações

## 1. Contexto

Durante a revisão da Pull Request da PIC-2, foi identificada uma vulnerabilidade em potencial de Cross-Site Scripting (XSS). As configurações inseridas no painel de administração (`escolaNome` e `escolaLogo`) estavam sendo injetadas diretamente como string no template HTML do gerador de PDF (`pdfGenerator.js`) usando a função `String.replace()`. Além disso, a rota da API Express não estava aplicando validações nem requerendo obrigatoriedade do nome da escola.

Se um texto malicioso como `<script>alert('xss')</script>` ou atributos de imagem como `" onerror="alert(1)` fossem enviados para o banco, isso poderia causar uma falha na renderização do Chromium *headless* no momento da emissão das carteirinhas.

## 2. Decisão

- Criar um módulo utilitário de segurança (`src/utils/security.js`) com a função `escapeHtml()`, responsável por converter caracteres especiais (`<, >, &, ", '`) em `HTML Entities`.
- Implementar a função `validateLogoUrl()` para evitar pseudo-protocolos como `javascript:` na inserção da logomarca.
- Na API (`src/api/routes.js`), validar o campo `escolaNome` (trim) para impedir strings vazias ou nulas. Se for vazia, retornar HTTP 400 Bad Request.
- **Defense in Depth (Defesa em Camadas)**: A sanitização (`escapeHtml`) será aplicada em **dois momentos**:
  1. Durante a requisição `POST /api/config`, antes de salvar no banco local (garante que os dados no JSON estarão higienizados).
  2. Dentro do `pdfGenerator.js`, logo antes da interpolação `replace()` final, em campos vitais como `nome`, `matricula` e `turma_nome`. Essa camada protege o PDF caso dados sejam manipulados manualmente ou por outras origens de dados.

## 3. Consequências

- Segurança fortalecida na manipulação de configurações globais.
- Proteção nativa no *headless browser* contra quebra de layout ou *code injection* durante a geração de carteirinhas.
- O campo `escolaNome` agora é estritamente obrigatório.
