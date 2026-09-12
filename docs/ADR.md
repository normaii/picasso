# Picasso — Architecture Decision Records (ADR)

Documento de registro de todas as decisões arquiteturais e de design tomadas no projeto Picasso.

> **Formato**: Cada ADR segue o padrão: **Contexto** → **Decisão** → **Justificativa** → **Consequências**

---

## Índice

| ADR | Título | Status | Data |
|-----|--------|--------|------|
| [ADR-001](#adr-001) | Sistema alvo para scraping | ✅ Aceito | 2026-08-13 |
| [ADR-002](#adr-002) | Estratégia de autenticação | ✅ Aceito | 2026-08-13 |
| [ADR-003](#adr-003) | Tipo de aplicação (Desktop vs Web) | ✅ Aceito | 2026-08-13 |
| [ADR-004](#adr-004) | Armazenamento de dados | ✅ Aceito | 2026-08-13 |
| [ADR-005](#adr-005) | Idioma da interface | ✅ Aceito | 2026-08-13 |
| [ADR-006](#adr-006) | Stack tecnológica | ✅ Aceito | 2026-08-13 |
| [ADR-007](#adr-007) | Estratégia de scraping dos dados | ✅ Aceito | 2026-08-13 |
| [ADR-008](#adr-008) | Estratégia de scraping das fotos | ✅ Aceito | 2026-08-13 |
| [ADR-009](#adr-009) | Formato de saída (PDF) | ✅ Aceito | 2026-08-13 |
| [ADR-010](#adr-010) | Estrutura do projeto | ✅ Aceito | 2026-08-13 |

---

## ADR-001
### Sistema Alvo para Scraping

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Precisávamos identificar o sistema web de onde seriam extraídos os dados dos alunos (nome, matrícula, turma e foto).

**Decisão**: O sistema alvo é o **Conexão Educação** da Secretaria de Educação do Estado do Rio de Janeiro.
- URL base: `https://conexao.educacao.rj.gov.br`
- Relatório de alunos: `/ConexaoEducacao/Relatorio/PageViewer.aspx?report=RelAlunosMatPTurma&grp=GESTAO`
- Cadastro de alunos (foto): `/ConexaoEducacao/Academico/Alunos.aspx`

**Justificativa**: É o sistema oficial utilizado pela direção escolar para gestão acadêmica. Todos os dados necessários estão disponíveis via HTML scraping.

**Consequências**:
- O scraper deve ser adaptado especificamente para a estrutura HTML do Conexão Educação
- Alterações na interface do sistema podem quebrar o scraper (risco de manutenção)
- O acesso depende das credenciais do diretor

---

## ADR-002
### Estratégia de Autenticação

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: O Conexão Educação possui CAPTCHA no formulário de login, impossibilitando login automatizado.

**Decisão**: Implementar login **manual** via janela de navegador embutida (Electron). O diretor faz login normalmente (incluindo CAPTCHA), e o sistema captura os cookies da sessão para reutilizá-los no scraping automatizado.

**Justificativa**:
- CAPTCHA impede automação do login
- Login manual é a abordagem mais confiável e não viola políticas de uso
- Cookies de sessão podem ser reutilizados pelo Playwright

**Consequências**:
- O diretor precisa fazer login manualmente a cada sessão de scraping
- A sessão pode expirar durante o scraping (necessário tratamento de timeout)
- Não há necessidade de armazenar credenciais

---

## ADR-003
### Tipo de Aplicação (Desktop vs Web)

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Avaliamos se Picasso deveria ser um app web hospedado ou um app desktop local.

**Decisão**: **Aplicação desktop offline** usando Electron, rodando localmente na máquina do diretor.

**Justificativa**:
- Não requer infraestrutura de hospedagem
- Funciona offline após o scraping
- Integra naturalmente com Google Drive via sincronização de pasta local
- Electron permite a janela de login embutida para CAPTCHA

**Consequências**:
- Distribuição via instalador local (ou executável portátil)
- Atualizações precisam ser distribuídas manualmente (ou via auto-update do Electron)
- Tamanho do app será maior (~150MB+ por causa do Chromium embutido)

---

## ADR-004
### Armazenamento de Dados

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Precisávamos definir onde armazenar os dados scrapeados (banco de dados, fotos dos alunos) e os PDFs gerados.

**Decisão**: Usar **SQLite** como banco de dados e armazenar todos os arquivos (DB, fotos, PDFs) em uma **pasta local sincronizada com Google Drive**.

**Justificativa**:
- SQLite é zero-config, um único arquivo, portátil
- Google Drive sync oferece backup automático na nuvem sem complexidade
- O diretor pode acessar os PDFs gerados de qualquer dispositivo via Google Drive

**Consequências**:
- O caminho da pasta Google Drive deve ser configurável
- Conflitos de sincronização são possíveis se múltiplas instâncias acessarem o DB simultaneamente (improvável neste caso de uso)
- Fotos ficam acessíveis na nuvem automaticamente

---

## ADR-005
### Idioma da Interface

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Definir o idioma da interface do usuário e das carteirinhas geradas.

**Decisão**: **Português (pt-BR)** para toda a interface, labels, mensagens e conteúdo das carteirinhas.

**Justificativa**: Os usuários finais (diretores escolares) são brasileiros, e o sistema alvo já está em português.

**Consequências**:
- Todas as strings da UI em pt-BR
- Documentação técnica (código, comentários) pode permanecer em inglês
- Nomes de variáveis e APIs podem permanecer em inglês

---

## ADR-006
### Stack Tecnológica

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Seleção das tecnologias para cada camada da aplicação.

**Decisão**:

| Camada | Tecnologia |
|---|---|
| Desktop | Electron |
| Front-End | HTML + CSS + JS (Vanilla) |
| Backend | Node.js + Express |
| Scraping | Playwright |
| Banco de Dados | SQLite (`better-sqlite3`) |
| Geração de PDF | Puppeteer |

**Justificativa**:
- **Electron**: Necessário para janela de login embutida e distribuição desktop
- **Vanilla Front-End**: Simplicidade, sem build step, carregamento rápido
- **Express**: Leve e familiar para API REST interna
- **Playwright**: Mais moderno e robusto que Puppeteer para scraping, melhor suporte a múltiplos browsers
- **SQLite**: Zero-config, arquivo único, ideal para uso local
- **Puppeteer**: Excelente para renderização HTML → PDF com fidelidade ao CSS

**Consequências**:
- Sem necessidade de bundler ou framework complexo
- Playwright e Puppeteer compartilham engines similares (ambos baseados em Chromium)
- Possível otimização futura: usar apenas um dos dois (Playwright poderia gerar PDF também)

---

## ADR-007
### Estratégia de Scraping dos Dados

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Definir como extrair os dados dos alunos (nome, matrícula, turma) do Conexão Educação.

**Decisão**: Scraping da página de relatório `RelAlunosMatPTurma` (Relatório de Alunos Matriculados Por Turma).

**Detalhes**:
- URL: `https://conexao.educacao.rj.gov.br/ConexaoEducacao/Relatorio/PageViewer.aspx?report=RelAlunosMatPTurma&grp=GESTAO`
- Navegar com cookies de sessão capturados
- Parsear tabelas HTML para extrair dados
- Iterar por turmas disponíveis

**Justificativa**: Este relatório já contém todos os dados necessários em formato tabular (nome, matrícula, turma).

**Consequências**:
- Dependente da estrutura HTML do relatório (frágil a mudanças no sistema)
- Pode haver paginação ou carregamento dinâmico a ser tratado
- Necessário investigar a estrutura exata do HTML durante o desenvolvimento

---

## ADR-008
### Estratégia de Scraping das Fotos

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: As fotos dos alunos não estão no relatório de alunos, mas na página individual de cadastro.

**Decisão**: Para cada aluno, navegar à página `Alunos.aspx`, buscar pela matrícula e extrair a URL da foto.

**Detalhes**:
- URL: `https://conexao.educacao.rj.gov.br/ConexaoEducacao/Academico/Alunos.aspx`
- Buscar aluno por matrícula
- Foto encontrada no elemento: `img#ct100_cphFormulario_bimgFotoPessoa`
- URL da foto usa parâmetro `DXCache`: `/ConexaoEducacao/Academico/Alunos.aspx?DXCache={hash}`
- Salvar como `{matricula}.jpg`

**Justificativa**: É a única forma disponível de obter as fotos no sistema. A foto está vinculada ao elemento identificado via DevTools.

**Consequências**:
- Processo mais lento (uma requisição por aluno)
- Pode ser paralelizado com cautela (evitar sobrecarga no servidor)
- Alunos sem foto receberão um placeholder

---

## ADR-009
### Formato de Saída (PDF)

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Definir o formato de saída das carteirinhas para impressão.

**Decisão**: Gerar **PDF em formato A4** com múltiplas carteirinhas por página, pronto para impressão.

**Detalhes**:
- Carteirinha individual: 86mm × 54mm (tamanho cartão de crédito)
- Layout A4: ~8-10 carteirinhas por página (2 colunas × 4-5 linhas)
- Pipeline: HTML/CSS template → Puppeteer → PDF

**Justificativa**: PDF A4 é o formato mais prático para impressão em escolas, que tipicamente possuem impressoras padrão A4.

**Consequências**:
- Necessário acertar dimensões exatas para corte
- Possível incluir marcas de corte no PDF
- Design da carteirinha deve funcionar bem no tamanho de cartão

---

## ADR-010
### Estrutura do Projeto

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Organização dos arquivos e diretórios do projeto.

**Decisão**: Estrutura modular com separação clara de responsabilidades:

```
picasso/
├── main.js              # Electron
├── server.js            # Express
├── public/              # Front-end
├── src/
│   ├── api/             # Endpoints REST
│   ├── db/              # Banco de dados
│   ├── scraper/         # Módulos de scraping
│   └── generator/       # Geração de PDF
├── data/                # Dados (sincronizável com GDrive)
└── assets/              # Recursos estáticos
```

**Justificativa**: Separação clara facilita manutenção, teste e entendimento do código.

**Consequências**:
- Cada módulo pode ser desenvolvido e testado independentemente
- Facilita contribuições futuras
- Pasta `data/` pode ser configurada para apontar para o Google Drive

---

## Histórico de Alterações

| Data | Alteração |
|------|-----------|
| 2026-08-13 | Criação do documento com ADR-001 a ADR-010 |
