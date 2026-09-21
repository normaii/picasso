/**
 * Configuração multi-branch do semantic-release para o Picasso.
 * 
 * Branches:
 * - master  → release estável (latest)
 * - release → UAT pre-release (rc)
 * - develop → dev build draft (dev)
 * 
 * Ref: docs/ADR/PIC-1.md — Decisão D4
 */
module.exports = {
  branches: [
    'master',
    { name: 'release', prerelease: 'rc', channel: 'rc' },
    { name: 'develop', prerelease: 'dev', channel: 'dev' }
  ],
  plugins: [
    ['@semantic-release/commit-analyzer', {
      preset: 'conventionalcommits',
      releaseRules: [
        { type: 'feat', release: 'minor' },
        { type: 'fix', release: 'patch' },
        { type: 'perf', release: 'patch' },
        { type: 'revert', release: 'patch' },
        { type: 'docs', release: false },
        { type: 'style', release: false },
        { type: 'refactor', release: false },
        { type: 'test', release: false },
        { type: 'chore', release: false },
        { type: 'ci', release: false }
      ]
    }],
    ['@semantic-release/release-notes-generator', {
      preset: 'conventionalcommits',
      presetConfig: {
        types: [
          { type: 'feat', section: '✨ Funcionalidades' },
          { type: 'fix', section: '🐛 Correções' },
          { type: 'perf', section: '⚡ Performance' },
          { type: 'revert', section: '⏪ Reversões' },
          { type: 'docs', section: '📚 Documentação', hidden: false },
          { type: 'style', section: '💅 Estilo', hidden: true },
          { type: 'refactor', section: '♻️ Refatoração', hidden: false },
          { type: 'test', section: '🧪 Testes', hidden: true },
          { type: 'chore', section: '🔧 Manutenção', hidden: true },
          { type: 'ci', section: '🏗️ CI/CD', hidden: true }
        ]
      }
    }],
    ['@semantic-release/changelog', {
      changelogFile: 'CHANGELOG.md',
      changelogTitle: '# Changelog — Picasso\n\nTodas as mudanças notáveis do projeto são documentadas neste arquivo.\nFormato baseado em [Conventional Commits](https://www.conventionalcommits.org/).\n'
    }],
    ['@semantic-release/npm', {
      npmPublish: false // Não publicar no npm, apenas atualizar package.json
    }],
    ['@semantic-release/git', {
      assets: ['package.json', 'package-lock.json', 'CHANGELOG.md'],
      message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
    }],
    ['@semantic-release/github', {}]
  ]
};
