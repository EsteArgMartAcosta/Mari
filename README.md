# Mariana floresce

Algumas pessoas recebem flores. Mariana recebeu um jardim que aprende a nascer com ela.

## GitHub Pages

Jardim: https://esteargmartacosta.github.io/Mari/

Livro: https://esteargmartacosta.github.io/Mari/livro/

A publicação usa a branch `main`, pasta raiz, na configuração nativa do GitHub Pages. Não é necessário instalar dependências nem executar build.

## O livro de Mariana

A sala de leitura está em [`livro/`](livro/). Ela preserva as 250 páginas do PDF original, com páginas duplas no computador e página única em telas menores. O jardim ganhou um acesso discreto no topo e uma seção de convite antes do encerramento; os arquivos originais `script.js` e `styles.css` não foram modificados.

O leitor inclui índice dos 14 capítulos, anterior/próxima, setas do teclado, gestos horizontais no celular, salto por número, barra de progresso, zoom, leitura em texto, fundo claro/escuro, tela cheia quando permitida pelo navegador, links do PDF e download do original. A última posição e a preferência de fundo ficam apenas no armazenamento local do navegador. O endereço `livro/#pagina=42` abre uma posição específica.

O arquivo original está em `livro/assets/contos-para-sumerce-linda.pdf`. Seu conteúdo e seus bytes foram preservados. A capa é uma prévia renderizada da primeira página; `book.json` contém os destinos de capítulos extraídos dos marcadores do PDF.

PDF.js 6.5.438 (Mozilla, Apache-2.0) é distribuído localmente em `livro/vendor/`, com o worker da mesma versão, recursos e licenças. Não há um serviço externo recebendo o PDF. As fontes da interface vêm do Google Fonts, como no jardim existente. Se o navegador não conseguir iniciar o leitor, o link do PDF continua disponível.

### Verificação

```sh
node --test tests/navigation.test.mjs
```

Os testes percorrem todas as 250 páginas nos dois sentidos e nas duas disposições, incluindo capa, última página e limites de URL. A prévia foi revisada no navegador em largura de desktop e em uma janela de leitura de 390 px. A publicação continua usando a configuração nativa do GitHub Pages deste repositório; não foi adicionado um segundo fluxo de deploy.

### Validação da conclusão — 7 de novembro de 2026

- PDF: 250 páginas renderizadas individualmente, nenhuma página sem conteúdo; 14 destinos do sumário conferidos com os marcadores originais.
- SHA-256 do PDF original: `f875fd94bd5bf4885f1f726f46a61ebc4579aaa0f6df3939d39605eae86c17f7` (7.944.047 bytes).
- Navegador: percurso sequencial das 250 páginas, confirmação de canvas e texto em cada página, sem painel de erro. Sumário, links internos do PDF, zoom de 200%, leitura em texto, teclado e retomada da última posição conferidos.
- Layout revisado em computador e em janelas de 390 × 844 e 320 × 568 pixels; isso não substitui testes em aparelhos físicos.
- Apenas uma ou duas páginas são renderizadas por vez. Há limite de resolução do canvas, carregamento por intervalos quando o servidor suporta e liberação de recursos também quando a navegação é cancelada.
- `script.js`, `styles.css` e `flower-icon.svg` permanecem idênticos à versão original.

### Voltar à versão anterior

A branch `backup/garden-before-book-2026-11-07` conserva o commit `23f092c3abe4b68f1d6d6388451186e8b777c995`, anterior à integração. Para reverter a publicação preservando o histórico, reverta os commits da integração com `git revert` e publique o novo commit em `main`. Não é necessário forçar o histórico.
