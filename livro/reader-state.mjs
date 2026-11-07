/** Pure navigation rules; page numbers refer to PDF positions, not printed labels. */
export function clampPage(value, total) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(total, Math.trunc(n))) : 1;
}
export function visiblePages(page, total, spread) {
  page = clampPage(page, total);
  if (!spread || page === 1) return [page];
  const first = page % 2 ? page - 1 : page;
  return first < total ? [first, first + 1] : [first];
}
export function adjacentPage(page, total, spread, direction) {
  const shown = visiblePages(page, total, spread);
  return direction > 0 ? clampPage(shown.at(-1) + 1, total) : clampPage(shown[0] - 1, total);
}
export function pageFromHash(hash, total) {
  const match = /^#pagina=(\d+)$/.exec(hash);
  return match ? clampPage(match[1], total) : null;
}
