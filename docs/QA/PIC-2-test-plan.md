# Plano de Testes (QA) - PIC-2 (Configurações Multi-escola)

## Objetivo
Validar que a parametrização do "Nome da Escola" funciona corretamente, substituindo os dados hardcoded (chumbados) tanto na interface quanto na geração dos cartões PDF, e garantindo a persistência destas configurações.

## Pré-requisitos
- O aplicativo Picasso deve estar rodando.
- Deve haver pelo menos 1 turma sincronizada (via aba AdD) para permitir a geração de um PDF.

## Cenários de Teste

### Cenário 1: Salvar novas configurações com sucesso
1. Abra o aplicativo Picasso.
2. No menu lateral esquerdo, clique na aba **Configurações**.
3. No campo "Nome Oficial da Escola", digite `ESCOLA DE TESTE QA`.
4. Deixe o campo "Logo da Escola" vazio ou com um link de teste (lembrando que nesta versão o upload nativo ainda não está pronto, aguardando PIC-11).
5. Clique em **Salvar Configurações**.
**Resultado Esperado:** O sistema deve exibir um alerta nativo com a mensagem "Configurações salvas com sucesso!".

### Cenário 2: Persistência de dados (Banco JSON)
1. Após executar o Cenário 1, feche completamente o aplicativo Picasso.
2. Abra novamente o aplicativo.
3. Navegue até a aba **Configurações**.
**Resultado Esperado:** O campo "Nome Oficial da Escola" deve estar preenchido automaticamente com `ESCOLA DE TESTE QA`, lendo a informação diretamente do banco de dados.

### Cenário 3: Injeção correta das configurações no PDF
1. Com a configuração `ESCOLA DE TESTE QA` salva, acesse a aba **Gerador de Identificação (GdI)**.
2. Escolha qualquer turma e clique em **Gerar PDF**.
3. Aguarde o alerta de sucesso e abra o arquivo PDF gerado (salvo na pasta local).
**Resultado Esperado:**
- No verso do cartão (lado esquerdo do PDF), o nome no topo deve ser **ESCOLA DE TESTE QA**.
- Na frente do cartão (lado direito do PDF, no cabeçalho curvo), o nome também deve ser **ESCOLA DE TESTE QA**.
- Não deve haver resquícios de nomes antigos como "C.E. Rio de Janeiro" ou similar, a menos que este seja o nome configurado na aba de configurações.

## Possíveis Bugs a Observar
- **Falta de sincronia:** Salvar a configuração, gerar o PDF rapidamente em seguida e o PDF ainda sair com o nome antigo. 
- **Persistência falha:** Fechar e abrir o app e a configuração retornar em branco.
- **Caracteres Especiais:** Se houver acentuação pesada (ex: `COLÉGIO JOÃO D'ÁGUA & CIA`), o JSON deve persistir corretamente e o PDF não deve quebrar a renderização.
