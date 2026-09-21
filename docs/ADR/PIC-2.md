# PIC-2 — Configurações Multi-escola (Nome da Escola)

**Issue**: [#7](https://github.com/normaii/picasso/issues/7)
**Status**: ✅ Aceito
**Data de Criação**: 2026-09-21
**Data de Aprovação**: 2026-09-21
**Autor**: @normaii

---

## Contexto

A aplicação Picasso inicialmente possuía dados "chumbados" no código fonte ou nos templates (ex: "ESCOLA ESTADUAL XY"), o que impedia sua adoção por múltiplas instituições ou mesmo o seu uso correto como produto de prateleira (SaaS/Desktop).

A versão Alpha utilizou um `localStorage` no frontend como *mock* para viabilizar a edição desses parâmetros. Entretanto, o `localStorage` está atrelado à sessão do navegador/Chromium e não é um armazenamento durável para configurações globais a longo prazo.

---

## Decisões

### D1 — Migração de `localStorage` para JSON DB
Todas as configurações globais da escola (`escolaNome`, `escolaLogo`) agora serão persistidas no arquivo oficial de banco de dados (`picasso_db.json`) dentro do objeto raiz `configuracoes`.
Isso garante persistência entre sessões e possibilita a injeção via backend.

### D2 — Isolamento do Frontend
O arquivo `app.js` deixa de ser responsável por gerenciar `localStorage`. A aba "Configurações" passa a consumir os endpoints REST do Express:
- `GET /api/config`: Para carregar as configurações ao iniciar o app.
- `POST /api/config`: Para salvar novas configurações.

### D3 — Fonte Única de Verdade no PDF
O módulo `pdfGenerator.js` passa a ler o nome da escola através das configurações do backend (via `getConfiguracoes()`) em vez de receber esse parâmetro obrigatoriamente pelo frontend durante a chamada da rota `/api/pdf/gerar`. Isso impede que injeções vindas do frontend burlem a configuração salva.

---

## Consequências

- A aplicação se torna agnóstica de instituição, exigindo parametrização pelo usuário final.
- Preparação de terreno para a **PIC-11** (Upload de Logo da Escola), que utilizará esta mesma infraestrutura.
- A Issue **PIC-28** (Vulnerabilidade XSS) foi desmembrada desta ADR para tratar especificamente de sanitização antes de injetar os valores no HTML do gerador.

---

## Implementação Técnica

- Adicionado objeto `configuracoes: {}` no `src/db/database.js`.
- Funções `getConfiguracoes()` e `salvarConfiguracoes(novasConfiguracoes)` implementadas.
- Endpoints implementados em `src/api/routes.js`.
- Ajustes em `public/app.js` e `public/index.html`.
