# PIC-1 — Definir Esquema de Versionamento Semântico e Branching Model

**Issue**: [#6](https://github.com/normaii/picasso/issues/6)
**Status**: 🔄 Em Discussão
**Data de Criação**: 2026-09-17
**Autor**: @normaii

---

## Contexto

Com o encerramento da fase Alpha (v0.0.10), o projeto Picasso precisa formalizar:
1. O esquema de versionamento semântico para cada ambiente (develop, release, master).
2. O modelo de branching (Git Flow adaptado) com regras de proteção.
3. As GitHub Actions responsáveis pelo auto-bump de versão em cada branch.
4. A automação de merge-back de `master` → `develop` após releases.

O esquema de versionamento proposto pelo stakeholder envolve regras diferentes de incremento dependendo da branch de origem do PR e da branch de destino, o que exige refinamento para evitar conflitos de numeração.

---

## Decisão

> ⏳ **Pendente de refinamento** — Este ADR será preenchido durante a execução da tarefa PIC-1.

### Tópicos a definir:

- [ ] Regra de incremento de versão ao fazer merge em `develop`
- [ ] Regra de incremento de versão ao fazer merge em `release` (via develop)
- [ ] Regra de incremento de versão ao fazer merge em `release` (via hotfix/*)
- [ ] Regra de incremento de versão ao promover `release` → `master`
- [ ] Branch protection rules para cada branch
- [ ] Automação de merge-back (master → develop)
- [ ] Diagrama Mermaid do fluxo completo

---

## Justificativa

> ⏳ Será preenchido após a decisão.

---

## Consequências

> ⏳ Será preenchido após a decisão.

---

## Referências

- [ADR-018 (Alpha Baseline)](./ADR-ALPHA-BASELINE.md#adr-018) — Pipeline de Auto-Bumping e Pre-Releases (versão Alpha)
- [Steering Memory](../steering/memory.md) — Documentação viva do projeto
