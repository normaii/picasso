# PIC-3: Arquivamento e Expurgo de Dados (LGPD)

## Status
Aceito (Implementação V10)

## Contexto
O requisito original (ADR-013) estabelecia a necessidade de exclusão total (*hard-delete*) dos dados de alunos para encerramento do ciclo letivo. No entanto, analisando as necessidades reais de segurança operacional de uma escola, uma exclusão irreversível de dados estruturados e de carteirinhas geradas pode ser perigosa em caso de acionamento acidental ou necessidades de auditoria posteriores. Ao mesmo tempo, as imagens (fotos) dos alunos continuam representando o maior peso de armazenamento e o maior risco de privacidade (LGPD).

## Decisão
Foi decidido adotar uma estratégia mista de retenção (Soft-Delete e Hard-Delete):
1. **Soft-Delete de Dados e PDFs:** Ao iniciar o expurgo, o banco JSON e todos os PDFs gerados serão movidos (arquivados) para pastas de backup (`$DATA_DIR/archive_db/` e `$DATA_DIR/pdfs/archive_pdfs/`) agrupados por um *timestamp*.
2. **Preservação de Configuração Global:** O banco de dados de produção (`picasso_db.json`) será recriado zerado (IDs resetados, arrays vazios), mas o objeto global de `configuracoes` (Nome da Escola e Logo) será herdado da base anterior.
3. **Hard-Delete de Fotos:** Todo o diretório `$DATA_DIR/fotos/` será deletado fisicamente e de forma irreversível.
4. **Interface:** O processo será disparado por um botão "Encerramento de Ciclo Letivo" nas Configurações, com modal de dupla confirmação.

## Arquitetura de Confiabilidade (V6–V10)
Após múltiplas rodadas de revisão estática (Copilot Code Review), as seguintes garantias de confiabilidade foram incorporadas:

### Implementadas nesta versão (V10)
- **Gravação Atômica do JSON (Windows-safe):** `saveDb()` grava num `.tmp` e tenta `renameSync`. Se falhar (comum no Windows por locks de antivírus/indexer), usa `copyFileSync` + `unlinkSync` como fallback. Erro de IO **propaga exceção** para abortar o expurgo.
- **Mutex Global (`isArchiving`):** Flag `try/finally` que bloqueia scraping, download de fotos e geração de PDFs durante o expurgo.
- **Mutex do Scraper (`isScrapingRunning`):** Flag in-memory no `scraper.js` com `try/finally`, evitando estados zumbis do JSON persistido.
- **Marcador de Fase Transacional (`.archive_committed`):** Arquivo sentinela gravado dentro da pasta temporária de fotos *após* o commit do banco (limpeza do JSON). Permite ao boot recovery distinguir entre crash pré-commit (restaurar fotos) e crash pós-commit (apagar lixo).
- **Boot Recovery Síncrono:** A varredura de pastas zumbis no `initDatabase()` é síncrona, executada antes do Express aceitar requisições.
- **Rollback com proteção individual:** Cada operação de `renameSync` de rollback é isolada em `try/catch` para não abortar em cascata.
- **Autenticação:** Header `x-admin-key` no endpoint destrutivo (fallback para Beta local).
- **Acessibilidade:** Modal com `role="dialog"`, `aria-modal`, Focus Management e tecla ESC.
- **Coordenação de PDF com arquivo ativo:** A trava `getIsArchiving()` está aplicada tanto na rota placeholder `/api/gerar` quanto na rota real `/api/pdf/gerar`, bloqueando geração de carteirinhas durante o expurgo.
- **Falha de hard-delete é tratada como falha operacional:** Se `rmSync` falhar ao deletar as fotos físicas, a operação retorna `success: false` com mensagem de erro clara para a UI, em vez de mascarar o problema como "sucesso com aviso".

### Riscos Residuais Aceitos (Decisão Consciente)
- **Micro-janela de crash entre `saveDb()` e `.archive_committed`:** Se o processo cair nos ~1ms entre o commit do banco e a gravação do sentinela, o boot recovery restaurará as fotos com banco vazio. Este cenário é aceito para o escopo Beta (1 escola, 1 servidor, Electron desktop). Probabilidade: infinitesimal. Mitigação: a secretária pode re-executar o encerramento de ciclo. Implementar protocolo 2PC/WAL seria overengineering neste porte de aplicação.

### Decisões Diferidas (Backlog Futuro)
Os seguintes pontos foram identificados durante o Code Review mas **deliberadamente adiados** por se tratarem de otimizações de segurança avançada incompatíveis com o escopo Beta local (1 escola, 1 servidor, Electron desktop):

1. **Autenticação robusta (sem fallback hardcoded):** O front-end Electron envia uma chave estática. Para produção SaaS, será necessário um mecanismo de sessão/token dinâmico. → *Issue futura quando o sistema virar produto multi-tenant.*
2. **Race condition assíncrono de download de fotos:** Existe uma micro-janela teórica entre o `check` de `isArchiving` na rota e o momento em que o photoFetcher muda seu status para `em_andamento`. Mitigação: o app é single-user local, mas em SaaS isso precisará de um semáforo async real.
3. **ADMIN_SECRET obrigatório sem fallback:** Em produção, o `.env` deveria ser obrigatório e o servidor deveria recusar iniciar sem ele. Para Beta local, o fallback hardcoded é aceitável pois o Electron roda na mesma máquina.

## Consequências
- **Positivas:** Permite que a escola tenha backups das turmas passadas e dos PDFs, garantindo rastreabilidade, enquanto remove permanentemente as fotos para adequação à LGPD. Sistema resiliente a falhas de energia e crashes do SO.
- **Negativas:** Requer um mínimo de gestão de disco ao longo de múltiplos anos, já que PDFs e pequenos JSONs se acumularão, embora o custo de armazenamento seja irrisório comparado às imagens originais.

