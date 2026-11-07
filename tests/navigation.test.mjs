import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPage, visiblePages, adjacentPage, pageFromHash } from '../livro/reader-state.mjs';
test('cover, even and odd pages, and the final singleton are correctly paired', () => {
 assert.deepEqual(visiblePages(1,250,true),[1]);
 assert.deepEqual(visiblePages(2,250,true),[2,3]);
 assert.deepEqual(visiblePages(5,250,true),[4,5]);
 assert.deepEqual(visiblePages(250,250,true),[250]);
 assert.deepEqual(visiblePages(5,250,false),[5]);
});
test('forward traversal visits all 250 pages exactly once in both layouts', () => {
 for (const spread of [false,true]) {
  let page=1; const seen=[];
  for (let i=0;i<251;i++) {
   const shown=visiblePages(page,250,spread); seen.push(...shown);
   if (shown.at(-1)===250) break;
   page=adjacentPage(page,250,spread,1);
  }
  assert.deepEqual(seen,Array.from({length:250},(_,i)=>i+1));
 }
});
test('backward traversal visits every page without skips', () => {
 for (const spread of [false,true]) {
  let page=250; const seen=[];
  for (let i=0;i<251;i++) {
   const shown=visiblePages(page,250,spread); seen.push(...shown.toReversed());
   if (shown[0]===1) break;
   page=adjacentPage(page,250,spread,-1);
  }
  assert.deepEqual(seen,Array.from({length:250},(_,i)=>250-i));
 }
});
test('URL state and invalid values cannot escape the PDF bounds', () => {
 assert.equal(clampPage(-9,250),1);assert.equal(clampPage(900,250),250);assert.equal(clampPage(NaN,250),1);
 assert.equal(pageFromHash('#pagina=242',250),242);assert.equal(pageFromHash('#pagina=999',250),250);
 assert.equal(pageFromHash('#readingStage',250),null);assert.equal(pageFromHash('#pagina=abc',250),null);
});
