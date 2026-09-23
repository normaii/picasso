# PIC-3: Arquivamento e Expurgo de Dados (LGPD)

## Status
Aceito (Fase de Planejamento)

## Contexto
O requisito original (ADR-013) estabelecia a necessidade de exclusão total (*hard-delete*) dos dados de alunos para encerramento do ciclo letivo. No entanto, analisando as necessidades reais de segurança operacional de uma escola, uma exclusão irreversível de dados estruturados e de carteirinhas geradas pode ser perigosa em caso de acionamento acidental ou necessidades de auditoria posteriores. Ao mesmo tempo, as imagens (fotos) dos alunos continuam representando o maior peso de armazenamento e o maior risco de privacidade (LGPD).

## Decisão
Foi decidido adotar uma estratégia mista de retenção (Soft-Delete e Hard-Delete):
1. **Soft-Delete de Dados e PDFs:** Ao iniciar o expurgo, o banco JSON e todos os PDFs gerados serão movidos (arquivados) para pastas de backup (`data/archive_db/` e `data/pdfs/archive_pdfs/`) agrupados por um *timestamp*.
2. **Preservação de Configuração Global:** O banco de dados de produção (`picasso_db.json`) será recriado zerado (IDs resetados, arrays vazios), mas o objeto global de `configuracoes` (Nome da Escola e Logo) será herdado da base anterior.
3. **Hard-Delete de Fotos:** Todo o diretório `data/fotos/` será deletado fisicamente e de forma irreversível.
4. **Interface:** O processo será disparado por um botão "Encerramento de Ciclo Letivo" nas Configurações, com modal de dupla confirmação.

## Consequências
- **Positivas:** Permite que a escola tenha backups das turmas passadas e dos PDFs, garantindo rastreabilidade, enquanto remove permanentemente as fotos para adequação à LGPD.
- **Negativas:** Requer um mínimo de gestão de disco ao longo de múltiplos anos, já que PDFs e pequenos JSONs se acumularão, embora o custo de armazenamento seja irrisório comparado às imagens originais.
