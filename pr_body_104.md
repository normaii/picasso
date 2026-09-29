Closes #98

## Resumo
Torna o campo **Logo da Escola (URL web ou Data URI)** opcional no formulário de Configurações, removendo a validação `required`. Além disso, atualiza o serviço de imagens default de `via.placeholder.com` (quebrado) para `placehold.co`.

## Bug Original
Durante a homologação da PIC-2, o QA identificou:
1. Ao deixar o campo de logo em branco, o navegador bloqueava a submissão com o alerta nativo `Preencha este campo`.
2. O fallback usado pelo `pdfGenerator.js` (`via.placeholder.com`) estava offline (retornando EOF / quebra de TLS), quebrando a geração de PDFs de alunos sem foto ou escolas sem logo.

## Correção Aplicada
- Removido o atributo `required` do `<input>` do campo `escola-logo` em `public/index.html`.
- O `type` permanece `text` (e não `url`). O label e helper text foram atualizados para especificar **Data URI** ao invés do termo genérico Base64, evitando conflitos com a validação do backend (que exige o prefixo `data:image/` e rejeita strings base64 cruas).
- Substituído o serviço de fallback em `src/generator/pdfGenerator.js` para usar o serviço funcional `placehold.co/150x150`.

## ADR
- [PIC-98.md](docs/ADR/PIC-98.md) — corrigido para refletir o nome real do campo `escolaLogo`, a correção de nomenclatura para Data URI, e o escopo correto da tarefa englobando a correção do backend (PDF).
