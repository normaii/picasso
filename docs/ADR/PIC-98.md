# ADR: PIC-98 - Campo Logo da Escola Opcional

## 1. Contexto

Durante a homologação da tarefa PIC-2 (Configurações Multi-escola), foi detectado o bug relatado na Issue #98: O campo "Logo da Escola (URL ou Base64)" do formulário de Configurações no front-end bloqueava o salvamento exibindo a mensagem "Preencha este campo" quando deixado em branco.
Isto ocorreu porque o `<input>` continha a tag `required` em seu código HTML. Como a funcionalidade de upload definitivo da logo (PIC-11) ainda será construída, as escolas podem não possuir logo no momento, devendo o sistema aceitar o registro em branco e aplicar uma imagem default.

## 2. Decisão

Para corrigir a vulnerabilidade de usabilidade:
1. **Frontend**: Remover o atributo `required` do campo de input correspondente ao "Logo da Escola" no arquivo `public/index.html`.
2. **Backend**: Assegurar que o módulo de gravação (na API/DB e no frontend `app.js`) aceite a string vazia `""` como um valor válido para `escolaLogo`, atualizando as `configuracoes` globais.
3. **Geração**: Se `escolaLogo` estiver em branco, o gerador de PDF (`src/generator/pdfGenerator.js`, linha 67) já aplica um fallback para uma imagem placeholder externa (`https://via.placeholder.com/150/...`). Este comportamento será mantido até a implementação da PIC-11, que introduzirá o upload de logo nativo e um asset embarcado definitivo.

## 3. Consequências

- **Melhoria UX:** Os usuários não ficarão travados caso apenas queiram alterar o nome da escola.
- **Transparência:** Mantém a retrocompatibilidade com o banco de dados que suportava propriedades em branco na chave `configuracoes.escolaLogo`.
- A implementação deste hotfix ocorrerá exclusivamente no front-end, eliminando riscos colaterais a outras funcionalidades do aplicativo.
