import { clampPage, visiblePages, adjacentPage, pageFromHash } from './reader-state.mjs';

const $ = id => document.getElementById(id);
const stage = $('readingStage'), mount = $('bookMount'), dialog = $('contentsDialog');
const keys = { page: 'mariana-book-v1-page', theme: 'mariana-book-v1-theme', layout: 'mariana-book-v1-layout' };
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, String(value)); return true; } catch { return false; } }
};
let pdf, pdfjs, metadata, renderGeneration = 0, running = false, dirty = false, activeTasks = [], flipAnimation;
let state = { page: 1, total: 250, zoom: 1, single: store.get(keys.layout) === 'single', text: false, direction: 0 };
const wide = matchMedia('(min-width: 861px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const isSpread = () => wide.matches && !state.single && !state.text;
const message = text => { $('readerMessage').textContent = text; };

function applyTheme(light) {
  document.body.classList.toggle('light', light);
  $('themeButton').setAttribute('aria-pressed', String(light));
  $('themeButton').setAttribute('aria-label', light ? 'Usar fundo escuro' : 'Usar fundo claro');
}
applyTheme(store.get(keys.theme) === 'light');
$('themeButton').addEventListener('click', () => {
  const light = !document.body.classList.contains('light'); applyTheme(light); store.set(keys.theme, light ? 'light' : 'dark');
});

function currentChapter() {
  return metadata?.chapters.filter(item => item.page <= state.page).at(-1);
}
function updateControls() {
  const pages = visiblePages(state.page, state.total, isSpread());
  $('previousButton').disabled = !pdf || pages[0] === 1;
  $('nextButton').disabled = !pdf || pages.at(-1) === state.total;
  for (const id of ['pageRange', 'pageInput', 'zoomSelect', 'textButton', 'layoutButton']) $(id).disabled = !pdf;
  $('pageForm').querySelector('button').disabled = !pdf;
  $('contentsButton').disabled = !pdf;
  $('pageInput').max = $('pageRange').max = state.total;
  $('pageInput').value = $('pageRange').value = state.page;
  $('pageTotal').textContent = `de ${state.total}`;
  $('layoutLabel').textContent = isSpread() ? 'Duas páginas' : 'Uma página';
  $('layoutButton').setAttribute('aria-label', isSpread() ? 'Mostrar uma página' : 'Mostrar duas páginas');
  $('layoutButton').disabled = !pdf || state.text;
  $('zoomSelect').disabled = !pdf || state.text;
  $('chapterLabel').textContent = currentChapter()?.title.replace(/^\d+\s+/, '') || 'Antes da primeira história';
  $('spreadLabel').textContent = pages.length === 2 ? `páginas ${pages[0]}–${pages[1]} do PDF` : 'posição no arquivo PDF';
  document.querySelectorAll('.contents-link').forEach(button => {
    const active = Number(button.dataset.page) === (currentChapter()?.page || 1);
    button.setAttribute('aria-current', String(active));
  });
}
function persistPosition() {
  const ok = store.set(keys.page, state.page);
  $('saveLabel').textContent = ok ? 'Sua leitura fica guardada neste dispositivo.' : 'Use o endereço desta página para continuar depois.';
  history.replaceState(null, '', `#pagina=${state.page}`);
}
function goTo(value, direction = 0) {
  if (!pdf) return;
  state.page = clampPage(value, state.total); state.direction = direction;
  persistPosition(); updateControls(); scheduleRender();
}
function step(direction) {
  if (!pdf) return;
  const next = adjacentPage(state.page, state.total, isSpread(), direction);
  if (next !== state.page) goTo(next, direction);
}

function scheduleRender() {
  if (!pdf) return;
  flipAnimation?.cancel();
  mount.querySelectorAll('.turning-leaf, .stationary-leaf').forEach(leaf => leaf.remove());
  dirty = true; renderGeneration++;
  activeTasks.forEach(task => task.cancel());
  if (!running) void renderLoop();
}
async function renderLoop() {
  running = true;
  while (dirty) {
    dirty = false;
    const generation = renderGeneration;
    stage.setAttribute('aria-busy', 'true');
    message('Preparando as páginas…');
    try {
      await renderBook(generation);
    } catch (error) {
      if (generation === renderGeneration && error?.name !== 'RenderingCancelledException') {
        console.error('Book page could not render:', error);
        showError('Esta página não carregou. Tente novamente ou abra o PDF original.');
      }
    }
  }
  running = false;
  stage.setAttribute('aria-busy', 'false');
}
async function renderBook(generation) {
  const numbers = visiblePages(state.page, state.total, isSpread());
  const pages = await Promise.all(numbers.map(number => pdf.getPage(number)));
  try {
    if (generation !== renderGeneration) return;
    const textMode = state.text;
    const book = document.createElement('div');
    book.className = textMode ? 'text-pages' : `book-spread ${numbers.length > 1 ? 'double' : 'single'}`;
    if (!reduced.matches && state.direction && !textMode) book.classList.add(state.direction > 0 ? 'turn-next' : 'turn-previous');
    const styles = getComputedStyle(stage);
    const availableWidth = Math.max(180, stage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight) - 12);
    const availableHeight = Math.max(150, stage.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom) - 4);
    if (textMode) book.style.width = `${Math.min(760, availableWidth)}px`;
    const views = pages.map(page => page.getViewport({ scale: 1 }));
    const ratioSum = views.reduce((sum, view) => sum + view.width / view.height, 0);
    const pageHeight = Math.min(availableHeight, availableWidth / ratioSum) * state.zoom;
    activeTasks = [];
    for (let i = 0; i < pages.length; i++) {
      if (generation !== renderGeneration) return;
      const page = pages[i];
      const article = document.createElement('article');
      article.setAttribute('aria-label', `Página ${numbers[i]} do arquivo PDF`);
      if (textMode) {
        article.className = 'text-page';
        const heading = document.createElement('h2'); heading.textContent = `PÁGINA ${numbers[i]}`;
        const paragraph = document.createElement('p');
        const content = await page.getTextContent();
        paragraph.textContent = content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('').trim() || 'Esta página contém uma imagem. Desative a leitura em texto para vê-la.';
        article.append(heading, paragraph);
      } else {
        article.className = 'sheet';
        const scale = pageHeight / views[i].height;
        const viewport = page.getViewport({ scale });
        article.style.width = `${viewport.width}px`; article.style.height = `${viewport.height}px`;
        article.style.setProperty('--scale-factor', scale);
        article.style.setProperty('--total-scale-factor', scale);
        article.style.setProperty('--user-unit', page.userUnit || 1);
        const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
        // Bound memory on high-DPI phones and at 200% zoom.
        const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(6000000 / (viewport.width * viewport.height)));
        canvas.width = Math.ceil(viewport.width * dpr); canvas.height = Math.ceil(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
        article.append(canvas);
        const task = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [dpr, 0, 0, dpr, 0, 0] });
        activeTasks.push(task);
        await task.promise;
        if (generation !== renderGeneration) return;
        const layer = document.createElement('div'); layer.className = 'textLayer';
        article.append(layer);
        const textLayer = new pdfjs.TextLayer({ textContentSource: await page.getTextContent(), container: layer, viewport });
        await textLayer.render();
        await addPdfLinks(page, article, viewport);
      }
      book.append(article);
    }
    if (generation !== renderGeneration) return;
    activeTasks = [];
    const previousBook = mount.querySelector('.book-spread');
    mount.replaceChildren(book);
    animatePageTurn(previousBook, book, state.direction);
    stage.scrollTop = 0; stage.scrollLeft = 0;
    state.direction = 0;
    $('errorPanel').hidden = true;
    message(numbers.length > 1 ? `Páginas ${numbers[0]} e ${numbers[1]} de ${state.total}` : `Página ${numbers[0]} de ${state.total}`);
  } finally {
    // Also release canceled or failed pages after rapid navigation.
    // Visible canvases and text remain; decoded PDF operators can be discarded.
    for (const page of pages) page.cleanup();
    activeTasks = [];
  }
}

// Use the actual rendered pages on both sides of the leaf. The PDF remains
// selectable underneath; temporary animation canvases are removed on completion.
function animatePageTurn(previous, next, direction) {
  if (reduced.matches || !direction || !previous?.classList.contains('double') || !next.classList.contains('double')) return;
  const oldPages = [...previous.querySelectorAll('.sheet > canvas')];
  const newPages = [...next.querySelectorAll('.sheet > canvas')];
  if (oldPages.length !== 2 || newPages.length !== 2 || oldPages[0].style.width !== newPages[0].style.width) return;
  next.classList.remove('turn-next', 'turn-previous');
  const forward = direction > 0;
  const copyCanvas = source => {
    const copy = source.cloneNode(false);
    copy.getContext('2d').drawImage(source, 0, 0);
    return copy;
  };
  const stationary = document.createElement('div');
  stationary.className = `stationary-leaf ${forward ? 'on-left' : 'on-right'}`;
  stationary.setAttribute('aria-hidden', 'true');
  stationary.append(copyCanvas(oldPages[forward ? 0 : 1]));
  const leaf = document.createElement('div');
  leaf.className = `turning-leaf ${forward ? 'on-right' : 'on-left'}`;
  leaf.setAttribute('aria-hidden', 'true');
  for (const [side, canvas] of [['front', oldPages[forward ? 1 : 0]], ['back', newPages[forward ? 0 : 1]]]) {
    const face = document.createElement('div'); face.className = `leaf-${side}`;
    face.append(copyCanvas(canvas)); leaf.append(face);
  }
  leaf.style.width = oldPages[0].style.width;
  leaf.style.height = oldPages[0].style.height;
  next.append(stationary, leaf);
  flipAnimation = leaf.animate([
    { transform: 'rotateY(0deg)' },
    { transform: `rotateY(${forward ? -180 : 180}deg)` }
  ], { duration: 620, easing: 'cubic-bezier(.25,.55,.25,1)', fill: 'forwards' });
  flipAnimation.finished.then(() => { stationary.remove(); leaf.remove(); }).catch(() => { stationary.remove(); leaf.remove(); });
}
function showError(text) { $('errorText').textContent = text; $('errorPanel').hidden = false; message('A leitura pode continuar no PDF original.'); }

async function addPdfLinks(page, article, viewport) {
  for (const item of await page.getAnnotations({ intent: 'display' })) {
    if (item.subtype !== 'Link' || !item.rect) continue;
    const anchor = document.createElement('a'); anchor.className = 'pdf-page-link';
    if (item.url) {
      try {
        const target = new URL(item.url);
        if (!['https:', 'http:', 'mailto:'].includes(target.protocol)) continue;
        anchor.href = target.href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
        anchor.setAttribute('aria-label', `Abrir link do livro: ${target.hostname || target.pathname}`);
      } catch { continue; }
    } else if (item.dest) {
      try {
        const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
        if (!dest) continue;
        const index = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]);
        const target = clampPage(index + 1, state.total);
        anchor.href = `#pagina=${target}`; anchor.setAttribute('aria-label', `Ir para a página ${target} do livro`);
        anchor.addEventListener('click', event => { event.preventDefault(); goTo(target); });
      } catch { continue; }
    } else continue;
    const [a, b, c, d, e, f] = viewport.transform;
    const [x1, y1, x2, y2] = item.rect;
    const rect = [a*x1 + c*y1 + e, b*x1 + d*y1 + f, a*x2 + c*y2 + e, b*x2 + d*y2 + f];
    Object.assign(anchor.style, { left: `${Math.min(rect[0], rect[2])}px`, top: `${Math.min(rect[1], rect[3])}px`, width: `${Math.abs(rect[2]-rect[0])}px`, height: `${Math.abs(rect[3]-rect[1])}px` });
    article.append(anchor);
  }
}

function buildContents() {
  const items = [{ title: 'Capa e dedicatória', page: 1 }, ...metadata.chapters];
  for (const item of items) {
    const button = document.createElement('button'); button.className = 'contents-link'; button.dataset.page = item.page;
    const match = /^(\d+)\s+(.+)$/.exec(item.title);
    const number = document.createElement('span'); number.className = 'chapter-number'; number.textContent = match ? match[1].padStart(2, '0') : '↟';
    const title = document.createElement('span'); title.className = 'chapter-title'; title.textContent = match ? match[2] : item.title;
    const position = document.createElement('span'); position.className = 'chapter-page'; position.textContent = `p. ${item.page}`;
    button.append(number, title, position);
    button.addEventListener('click', () => { dialog.close(); goTo(item.page); stage.focus({ preventScroll: true }); });
    $('contentsList').append(button);
  }
}
$('contentsButton').addEventListener('click', () => dialog.showModal());
$('closeContentsButton').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { const r = dialog.getBoundingClientRect(); if (event.clientX > r.right) dialog.close(); });
$('previousButton').addEventListener('click', () => step(-1));
$('nextButton').addEventListener('click', () => step(1));
$('pageForm').addEventListener('submit', event => { event.preventDefault(); goTo($('pageInput').value); $('pageInput').blur(); });
$('pageRange').addEventListener('input', () => { $('spreadLabel').textContent = `ir para a página ${$('pageRange').value}`; });
$('pageRange').addEventListener('change', () => goTo($('pageRange').value));
$('zoomSelect').addEventListener('change', () => { state.zoom = Number($('zoomSelect').value); scheduleRender(); });
$('layoutButton').addEventListener('click', () => { state.single = !state.single; store.set(keys.layout, state.single ? 'single' : 'spread'); updateControls(); scheduleRender(); });
$('textButton').addEventListener('click', () => { state.text = !state.text; $('textButton').setAttribute('aria-pressed', String(state.text)); $('textButton').setAttribute('aria-label', state.text ? 'Voltar às páginas originais' : 'Ler o texto da página'); updateControls(); scheduleRender(); });
$('fullscreenButton').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { message('Seu navegador não permite tela cheia. Você pode ampliar pelo controle de zoom.'); }
});
if (!document.fullscreenEnabled) $('fullscreenButton').hidden = true;
document.addEventListener('fullscreenchange', () => { $('fullscreenButton').setAttribute('aria-label', document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'); scheduleRender(); });
document.addEventListener('keydown', event => {
  if (dialog.open || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable) return;
  if (['ArrowRight', 'PageDown'].includes(event.key)) { event.preventDefault(); step(1); }
  if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); step(-1); }
  if (event.key === 'Home') { event.preventDefault(); goTo(1); }
  if (event.key === 'End') { event.preventDefault(); goTo(state.total); }
});
let touchStart;
stage.addEventListener('touchstart', event => { touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }, { passive: true });
stage.addEventListener('touchend', event => {
  if (!touchStart || state.zoom !== 1 || state.text || getSelection()?.toString()) return;
  const end = event.changedTouches[0], dx = end.clientX - touchStart.x, dy = end.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 65 && Math.abs(dx) > 1.8 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
}, { passive: true });
stage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
let resizeTimer;
new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { updateControls(); scheduleRender(); }, 160); }).observe(stage);
wide.addEventListener('change', () => { updateControls(); scheduleRender(); });
window.addEventListener('hashchange', () => { const page = pageFromHash(location.hash, state.total); if (page !== null) goTo(page); });
$('retryButton').addEventListener('click', () => { if (pdf) scheduleRender(); else location.reload(); });

async function load() {
  try {
    const [library, response] = await Promise.all([import('./vendor/pdf.min.mjs'), fetch('./assets/book.json')]);
    if (!response.ok) throw new Error('Book metadata could not load.');
    pdfjs = library; metadata = await response.json(); buildContents();
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
    const base = new URL('./vendor/', import.meta.url).href;
    const loading = pdfjs.getDocument({ url: new URL('./assets/contos-para-sumerce-linda.pdf', import.meta.url).href,
      cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`, isEvalSupported: false,
      disableAutoFetch: true, disableStream: true, rangeChunkSize: 262144 });
    loading.onProgress = ({ loaded, total }) => message(total ? `Abrindo o livro · ${Math.min(100, Math.round(100 * loaded / total))}%` : 'Abrindo o livro…');
    pdf = await loading.promise; loading.onProgress = null; state.total = pdf.numPages;
    state.page = pageFromHash(location.hash, state.total) ?? clampPage(store.get(keys.page) || 1, state.total);
    updateControls(); persistPosition(); scheduleRender();
  } catch { stage.setAttribute('aria-busy', 'false'); showError('Não foi possível carregar o leitor. Tente novamente ou continue no PDF original.'); }
}
void load();
