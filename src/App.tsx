import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultProject } from './data';
import { Asset, PageElement, PageDefinition, ProjectState, Rect } from './types';

const CANVAS_W = 1600;
const CANVAS_H = 2400;
const MIN_SIZE = 24;
const GRID = 2;

type DragMode = 'move' | 'resize-br' | null;

type Point = { x: number; y: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string));
}

function rectsOverlap(a: Rect, b: Rect) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

function normalizeTemplateName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="export-btn secondary" onClick={onClick}>
      {label}
    </button>
  );
}

function SlotEditor({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} rows={label.includes('文本') ? 4 : 2} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field compact">
      <span>{label}</span>
      <input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="field compact">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="action-chip" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2)}`;
}

function clonePage(page: PageDefinition): PageDefinition {
  return {
    ...page,
    elements: page.elements.map((el) => ({ ...el }))
  };
}

function cloneProjectState(state: ProjectState): ProjectState {
  return {
    ...state,
    assets: state.assets.map((asset) => ({ ...asset })),
    pages: state.pages.map((page) => clonePage(page))
  };
}

function getElementById(page: PageDefinition, id: string) {
  return page.elements.find((el) => el.id === id);
}

function parseHtmlTemplate(name: string, html: string): PageDefinition[] {
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
  const document = new DOMParser().parseFromString(html, 'text/html');

  // Check for parsing errors
  if (document.body?.querySelector('parsererror')) {
    return [buildFallbackPage(name, title, html)];
  }

  const pages = Array.from(document.querySelectorAll('.page')).length
    ? Array.from(document.querySelectorAll('.page'))
    : Array.from(document.body?.children ?? []);

  if (!pages.length) {
    return [buildFallbackPage(name, title, html)];
  }

  return pages.map((node, index) => buildPageFromHtmlNode(name, title, html, node, index));
}

function buildFallbackPage(name: string, title: string | undefined, html: string): PageDefinition {
  return {
    id: uid(normalizeTemplateName(title ?? name)),
    name: stripHtmlTags(name) || normalizeTemplateName(title ?? name),
    template: normalizeTemplateName(title ?? name),
    templateHtml: html,
    elements: [{
      id: 'slot-title-0',
      slot: 'title',
      kind: 'text',
      name: '标题',
      text: title ?? '新模板',
      x: 150,
      y: 220,
      w: 760,
      h: 150,
      fontSize: 88,
      fontWeight: 900,
      lineHeight: 1.05,
      color: '#17202b',
      zIndex: 2,
      locked: false
    } as PageElement]
  };
}

function buildPageFromHtmlNode(name: string, title: string | undefined, html: string, node: Element, index: number): PageDefinition {
  const pageLabel = node.getAttribute('data-page-name') || node.getAttribute('aria-label') || node.id || `${title ?? name} - ${index + 1}`;
  const imageNodes = Array.from(node.querySelectorAll('img'));
  const textNodes = Array.from(node.querySelectorAll('[class*="title"], [class*="subtitle"], [class*="body"], [class*="contact"], h1, h2, h3, p, .text'));

  const elements: PageElement[] = [];
  if (textNodes.length) {
    textNodes.forEach((textNode, textIndex) => {
      const text = stripHtmlTags(textNode.textContent || '');
      if (!text) return;
      const cls = textNode.getAttribute('class') || '';
      const isTitle = /title/i.test(cls) || /^h1$/i.test(textNode.tagName);
      const isSubtitle = /subtitle/i.test(cls) || /^h2$/i.test(textNode.tagName);
      const isBody = /body|text|p/i.test(cls) || /^p$/i.test(textNode.tagName);
      const isContact = /contact/i.test(cls);
      elements.push({
        id: `slot-text-${index}-${textIndex}`,
        slot: isTitle ? 'title' : isSubtitle ? 'subtitle' : isBody ? 'body' : isContact ? 'contact' : `text_${textIndex}`,
        kind: 'text',
        name: isTitle ? '标题' : isSubtitle ? '副标题' : isBody ? '正文' : isContact ? '联系信息' : `文本 ${textIndex + 1}`,
        text,
        x: 120 + textIndex * 20,
        y: 120 + textIndex * 110,
        w: 760,
        h: isTitle ? 150 : isSubtitle ? 56 : isContact ? 80 : 120,
        fontSize: isTitle ? 88 : isSubtitle ? 34 : 28,
        fontWeight: isTitle ? 900 : 700,
        lineHeight: isBody ? 1.6 : 1.25,
        color: isContact ? '#ffffff' : '#17202b',
        zIndex: 2,
        locked: false
      });
    });
  }

  if (imageNodes.length) {
    imageNodes.forEach((img, imageIndex) => {
      const src = img.getAttribute('src') || '';
      elements.push({
        id: `slot-image-${index}-${imageIndex}`,
        slot: `image_${imageIndex}`,
        kind: 'image',
        name: `图片 ${imageIndex + 1}`,
        sourceUrl: src,
        x: 900 + imageIndex * 20,
        y: 220 + imageIndex * 40,
        w: 580,
        h: 360,
        radius: 32,
        zIndex: 3 + imageIndex,
        locked: false
      });
    });
  }

  if (!elements.length) {
    elements.push({
      id: 'slot-title-0',
      slot: 'title',
      kind: 'text',
      name: '标题',
      text: title ?? pageLabel,
      x: 150,
      y: 220,
      w: 760,
      h: 150,
      fontSize: 88,
      fontWeight: 900,
      lineHeight: 1.05,
      color: '#17202b',
      zIndex: 2,
      locked: false
    });
  }

  return {
    id: uid(normalizeTemplateName(pageLabel)),
    name: stripHtmlTags(pageLabel) || `${normalizeTemplateName(title ?? name)}-${index + 1}`,
    template: normalizeTemplateName(title ?? name),
    templateHtml: html,
    elements
  };
}

function isSafeUrl(url: string): boolean {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:') || trimmed.startsWith('data:image/');
}

function renderTemplate(page: PageDefinition, assets: Asset[]) {
  if (!page.templateHtml) return '';
  const lookup = new Map(assets.map((asset) => [asset.id, asset.url]));
  const values = new Map<string, string>();
  page.elements.forEach((el) => {
    if (!el.slot) return;
    if (el.kind === 'image') {
      const url = lookup.get(el.assetId ?? '') ?? el.sourceUrl ?? '';
      values.set(el.slot, isSafeUrl(url) ? url : '');
    } else {
      values.set(el.slot, el.text ?? '');
    }
  });
  return page.templateHtml
    .replace(/<img([^>]*?)src="\{\{\s*([a-zA-Z0-9_:-]+)\s*\}\}"([^>]*)>/g, (_match, before, key, after) => `<img${before}src="${escapeHtml(values.get(key) ?? '')}"${after}>`)
    .replace(/\{\{\s*([a-zA-Z0-9_:-]+)\s*\}\}/g, (_match, key) => escapeHtml(values.get(key) ?? ''));
}

function getPageThumbnail(page: PageDefinition, assets: Asset[]) {
  const title = page.elements.find((el) => el.kind === 'text' && (/title/i.test(el.slot ?? '') || /title/i.test(el.name)))?.text ?? page.name;
  const image = page.elements.find((el) => el.kind === 'image');
  const imageUrl = image ? assets.find((asset) => asset.id === image.assetId)?.url ?? image.sourceUrl ?? '' : '';
  const body = page.elements.find((el) => el.kind === 'text' && (/body/i.test(el.slot ?? '') || /正文|body/.test(el.name)))?.text ?? '';
  return {
    title: stripHtmlTags(title).slice(0, 18),
    imageUrl,
    body: stripHtmlTags(body).slice(0, 28)
  };
}

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export default function App() {
  const [project, setProject] = useState<ProjectState>(defaultProject);
  const [selectedElementId, setSelectedElementId] = useState<string>('brand-title');
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [startRect, setStartRect] = useState<Rect | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0.62);
  const [history, setHistory] = useState<ProjectState[]>([]);
  const [future, setFuture] = useState<ProjectState[]>([]);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const activePage = useMemo(
    () => project.pages.find((page) => page.id === project.activePageId) ?? project.pages[0],
    [project.activePageId, project.pages]
  );

  const pushHistory = (nextProject: ProjectState) => {
    setHistory((prev) => [...prev, cloneProjectState(project)].slice(-50));
    setProject(nextProject);
    setFuture([]);
  };

  const patchProject = (updater: (state: ProjectState) => ProjectState) => {
    pushHistory(updater(cloneProjectState(project)));
  };

  const undo = () => {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const snapshot = prev[prev.length - 1];
      setProject((currentProject) => {
        setFuture((next) => [cloneProjectState(currentProject), ...next].slice(0, 50));
        return snapshot;
      });
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((prev) => {
      if (!prev.length) return prev;
      const snapshot = prev[0];
      setHistory((next) => [...next, cloneProjectState(project)].slice(-50));
      setProject(snapshot);
      return prev.slice(1);
    });
  };

  const selectedElement = activePage?.elements.find((el) => el.id === selectedElementId) ?? activePage?.elements.find((el) => !el.locked) ?? activePage?.elements[0];

  useEffect(() => {
    if (!activePage) return;
    if (selectedElementId && activePage.elements.some((el) => el.id === selectedElementId)) return;
    const nextSelected =
      activePage.elements.find((el) => el.id.endsWith('title'))?.id ??
      activePage.elements.find((el) => el.kind === 'image')?.id ??
      activePage.elements.find((el) => !el.locked)?.id ??
      activePage.elements[0]?.id ??
      '';
    if (nextSelected) {
      setSelectedElementId(nextSelected);
    }
  }, [activePage, selectedElementId]);

  const updateActivePage = (updater: (page: PageDefinition) => PageDefinition) => {
    patchProject((prev) => ({
      ...prev,
      pages: prev.pages.map((page) => (page.id === prev.activePageId ? updater(clonePage(page)) : page))
    }));
  };

  const updateElement = (elementId: string, patch: Partial<PageElement>) => {
    updateActivePage((page) => ({
      ...page,
      elements: page.elements.map((el) => (el.id === elementId ? { ...el, ...patch } : el))
    }));
  };

  const updateSelected = (patch: Partial<PageElement>) => {
    if (!selectedElement) return;
    updateElement(selectedElement.id, patch);
  };

  const moveSelected = (dx: number, dy: number) => {
    if (!selectedElement) return;
    updateSelected({
      x: clamp(selectedElement.x + dx, 0, CANVAS_W - selectedElement.w),
      y: clamp(selectedElement.y + dy, 0, CANVAS_H - selectedElement.h)
    });
  };

  const changeLayer = (delta: number) => {
    if (!selectedElement || !activePage) return;
    const sorted = [...activePage.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const index = sorted.findIndex((el) => el.id === selectedElement.id);
    if (index < 0) return;
    const target = clamp(index + delta, 0, sorted.length - 1);
    if (target === index) return;
    const next = [...sorted];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    updateActivePage((page) => ({
      ...page,
      elements: next.map((el, idx) => ({ ...el, zIndex: idx }))
    }));
  };

  const setSelectedByPoint = (x: number, y: number) => {
    if (!activePage) return;
    const hit = [...activePage.elements]
      .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
      .find((el) => x >= el.x && x < el.x + el.w && y >= el.y && y < el.y + el.h && !el.locked);
    if (hit) setSelectedElementId(hit.id);
  };

  const selectedAssetId = selectedElement?.assetId ?? activePage?.elements.find((el) => el.kind === 'image')?.assetId;

  const activeAsset = project.assets.find((asset) => asset.id === selectedAssetId) ?? project.assets[0];

  const bindAssetToSelected = (asset: Asset) => {
    if (!selectedElement || selectedElement.kind !== 'image') return;
    patchProject((state) => ({
      ...state,
      pages: state.pages.map((page) =>
        page.id !== state.activePageId
          ? page
          : {
              ...page,
              elements: page.elements.map((el) => (el.id === selectedElement.id ? { ...el, assetId: asset.id, sourceUrl: undefined } : el))
            }
      )
    }));
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const htmlFiles = Array.from(files).filter((file) => /\.html?$/i.test(file.name));
    const imageFiles = Array.from(files).filter((file) => /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name));

    if (htmlFiles.length) {
      Promise.all(htmlFiles.map((file) => file.text())).then((texts) => {
        const importedPages = texts.flatMap((html, index) => parseHtmlTemplate(htmlFiles[index].name, html));
        patchProject((prev) => ({
          ...prev,
          pages: [...importedPages, ...prev.pages],
          activePageId: importedPages[0]?.id ?? prev.activePageId
        }));
      });
    }

    if (imageFiles.length) {
      const newAssets: Asset[] = imageFiles.map((file) => ({
        id: uid(file.name),
        name: file.name,
        url: URL.createObjectURL(file),
        size: `${Math.round(file.size / 1024)} KB`
      }));
      patchProject((prev) => ({ ...prev, assets: [...newAssets, ...prev.assets] }));
    }
  };

  // Electron-specific: import files from disk paths (triggered by menu)
  const importFilesFromPaths = async (paths: string[], type: 'html' | 'image') => {
    if (!paths.length) return;
    if (type === 'html') {
      const results = await Promise.all(paths.map(async (filePath) => {
        const name = filePath.split(/[/\\]/).pop() || 'template.html';
        const content = await window.electronAPI!.readFile(filePath);
        return { name, content };
      }));
      const texts = results.map((r) => r.content);
      const importedPages = texts.flatMap((html, i) => parseHtmlTemplate(results[i].name, html));
      patchProject((prev) => ({
        ...prev,
        pages: [...importedPages, ...prev.pages],
        activePageId: importedPages[0]?.id ?? prev.activePageId
      }));
    } else if (type === 'image') {
      const binaryResults = await Promise.all(paths.map(async (filePath) => {
        return window.electronAPI!.readBinaryFile(filePath);
      }));
      const newAssets: Asset[] = binaryResults.filter(Boolean).map((result) => ({
        id: uid(result!.name),
        name: result!.name,
        url: `data:image/png;base64,${result!.data}`,
      }));
      patchProject((prev) => ({ ...prev, assets: [...newAssets, ...prev.assets] }));
    }
  };

  const exportHtml = async () => {
    const page = activePage;
    if (!page) return;
    const doc = buildHtml(page, project.assets);

    if (isElectron) {
      const filePath = await window.electronAPI!.saveHtmlDialog(`${page.id}.html`);
      if (filePath) {
        await window.electronAPI!.writeFile(filePath, doc);
      }
      return;
    }

    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${page.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = async () => {
    const json = JSON.stringify(project, null, 2);

    if (isElectron) {
      const filePath = await window.electronAPI!.saveJsonDialog('project.json');
      if (filePath) {
        await window.electronAPI!.writeFile(filePath, json);
      }
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  function buildHtml(page: PageDefinition, assets: Asset[]) {
    if (page.templateHtml) {
      return renderTemplate(page, assets);
    }
    const styleVars = `--canvas-w:${CANVAS_W}px;--canvas-h:${CANVAS_H}px;`;
    const assetLookup = new Map(assets.map((a) => [a.id, a.url]));
    const elementsHtml = page.elements
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      .map((el) => {
        const common = `left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;opacity:${el.opacity ?? 1};z-index:${el.zIndex ?? 0};${el.rotate ? `transform:rotate(${el.rotate}deg);` : ''}`;
        if (el.kind === 'shape') {
          return `<div class="el shape" style="${common};background:${el.bgColor ?? '#fff'};border-radius:${el.radius ?? 0}px;border:${el.borderWidth ?? 0}px solid ${el.borderColor ?? 'transparent'}"></div>`;
        }
        if (el.kind === 'image') {
          const assetUrl = assetLookup.get(el.assetId ?? '') ?? el.sourceUrl ?? '';
          return `<div class="el image" style="${common};border-radius:${el.radius ?? 0}px"><img src="${escapeHtml(assetUrl)}"/></div>`;
        }
        const align = el.align ?? 'left';
        return `<div class="el text" style="${common};color:${el.color ?? '#17202b'};font-size:${el.fontSize ?? 28}px;font-weight:${el.fontWeight ?? 700};line-height:${el.lineHeight ?? 1.5};letter-spacing:${el.letterSpacing ?? 0}px;text-align:${align}">${escapeHtml(el.text ?? '')}</div>`;
      })
      .join('');

    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
      html,body{margin:0;width:100%;height:100%;background:#f5f0e7}
      body{display:flex;justify-content:center;align-items:flex-start;font-family:'Noto Sans CJK SC','PingFang SC','Microsoft YaHei',sans-serif}
      .page{position:relative;width:1600px;height:2400px;overflow:hidden;background:#fbf8f2}
      .el{position:absolute;box-sizing:border-box}
      .text{white-space:pre-wrap;overflow:hidden}
      .image img{width:100%;height:100%;display:block;object-fit:cover}
    </style></head><body>
      <div class="page" style="${styleVars}">${elementsHtml}</div>
    </body></html>`;
  }

  const onPointerDownElement = (e: React.PointerEvent, el: PageElement, mode: DragMode = 'move') => {
    e.stopPropagation();
    setSelectedElementId(el.id);
    setDragMode(mode);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartRect({ x: el.x, y: el.y, w: el.w, h: el.h });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragMode || !dragStart || !startRect || !selectedElement) return;
    const scale = previewRef.current ? previewRef.current.getBoundingClientRect().width / CANVAS_W : 1;
    const dx = (e.clientX - dragStart.x) / scale;
    const dy = (e.clientY - dragStart.y) / scale;

    if (dragMode === 'move') {
      const next = { ...startRect, x: startRect.x + dx, y: startRect.y + dy };
      applyRect(next);
      return;
    }

    if (dragMode === 'resize-br') {
      const next = { ...startRect, w: startRect.w + dx, h: startRect.h + dy };
      applyRect(next);
    }
  };

  const applyRect = (next: Rect) => {
    if (!selectedElement) return;
    const maxW = Math.max(MIN_SIZE, CANVAS_W - next.x);
    const maxH = Math.max(MIN_SIZE, CANVAS_H - next.y);
    const clipped = {
      x: clamp(Math.round(next.x / GRID) * GRID, 0, CANVAS_W - MIN_SIZE),
      y: clamp(Math.round(next.y / GRID) * GRID, 0, CANVAS_H - MIN_SIZE),
      w: clamp(Math.round(next.w / GRID) * GRID, MIN_SIZE, maxW),
      h: clamp(Math.round(next.h / GRID) * GRID, MIN_SIZE, maxH)
    };
    updateElement(selectedElement.id, clipped);
    const overlaps = activePage.elements.filter((el) => el.id !== selectedElement.id && !el.locked && rectsOverlap(clipped, el));
    const out = [] as string[];
    if (clipped.x < 0 || clipped.y < 0 || clipped.x + clipped.w > CANVAS_W || clipped.y + clipped.h > CANVAS_H) {
      out.push('当前元素触碰到页面边界');
    }
    if (overlaps.length) out.push(`与 ${overlaps.slice(0, 2).map((o) => o.name).join('、')} 发生重叠`);
    setWarnings(out);
  };

  const onPointerUp = () => {
    setDragMode(null);
    setDragStart(null);
    setStartRect(null);
  };

  const addText = () => {
    if (!activePage) return;
    const next: PageElement = {
      id: uid('text'),
      kind: 'text',
      name: '新增文本',
      x: 260,
      y: 260,
      w: 320,
      h: 80,
      text: '新增文本',
      color: '#17202b',
      fontSize: 28,
      fontWeight: 700,
      zIndex: 10
    };
    patchProject((state) => ({ ...state, pages: state.pages.map((page) => page.id === state.activePageId ? { ...page, elements: [...page.elements, next] } : page) }));
    setSelectedElementId(next.id);
  };

  const addShape = () => {
    if (!activePage) return;
    const next: PageElement = {
      id: uid('shape'),
      kind: 'shape',
      name: '新增形状',
      x: 260,
      y: 260,
      w: 240,
      h: 120,
      bgColor: 'rgba(17,33,49,0.06)',
      radius: 18,
      zIndex: 10
    };
    patchProject((state) => ({ ...state, pages: state.pages.map((page) => page.id === state.activePageId ? { ...page, elements: [...page.elements, next] } : page) }));
    setSelectedElementId(next.id);
  };

  const duplicateElement = () => {
    if (!selectedElement || selectedElement.locked) return;
    const copy = { ...selectedElement, id: uid(selectedElement.kind), x: selectedElement.x + 30, y: selectedElement.y + 30, name: `${selectedElement.name} 副本` };
    patchProject((state) => ({ ...state, pages: state.pages.map((page) => page.id === state.activePageId ? { ...page, elements: [...page.elements, copy] } : page) }));
    setSelectedElementId(copy.id);
  };

  const removeElement = () => {
    if (!selectedElement || selectedElement.locked) return;
    const remainingElements = activePage.elements.filter((el) => el.id !== selectedElement.id);
    if (remainingElements.length === 0) {
      setWarnings(['无法删除最后一个元素']);
      return;
    }
    patchProject((state) => ({ ...state, pages: state.pages.map((page) => page.id === state.activePageId ? { ...page, elements: remainingElements } : page) }));
    setSelectedElementId(remainingElements.find((el) => !el.locked && el.id !== selectedElement.id)?.id ?? remainingElements[0]?.id ?? '');
  };

  const selectPage = (id: string) => {
    const page = project.pages.find((p) => p.id === id);
    patchProject((prev) => ({ ...prev, activePageId: id }));
    setSelectedElementId(page?.elements.find((el) => el.id.endsWith('title'))?.id ?? page?.elements.find((el) => !el.locked)?.id ?? page?.elements[0]?.id ?? '');
    setWarnings([]);
    setZoom(0.62);
  };

  const selectedImageAsset = selectedElement?.kind === 'image' ? project.assets.find((asset) => asset.id === selectedElement.assetId) : undefined;


  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Electron menu event listeners
    if (isElectron) {
      const api = window.electronAPI!;
      api.onImportHtmlFiles((paths) => importFilesFromPaths(paths, 'html'));
      api.onImportImageFiles((paths) => importFilesFromPaths(paths, 'image'));
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [history.length, future.length, project]);

  return (
    <div className="app-shell">
      <aside className="sidebar left">
        <div className="panel-title">素材库</div>
        <label className="upload">
          <input type="file" accept="image/*,.html,.htm" multiple onChange={(e) => handleFiles(e.target.files)} />
          <span>导入图片或 HTML</span>
        </label>
        <div className="info-line">支持导入图片素材和带 {`{{slot}}`} 占位符的 HTML 模板。</div>
        <div className="asset-grid">
          {project.assets.map((asset) => (
            <button
              key={asset.id}
              className={`asset-card ${activeAsset?.id === asset.id ? 'active' : ''}`}
              onClick={() => bindAssetToSelected(asset)}
            >
              <img src={asset.url} alt={asset.name} />
              <div className="asset-name">{asset.name}</div>
              <div className="asset-size">{asset.size ?? '本地素材'}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="center">
        <div className="topbar">
          <div>
            <div className="eyebrow">Qihang Handbook GUI</div>
            <h1>{project.projectName}</h1>
            <div className="info-line" style={{ marginTop: 10 }}>当前页：{activePage?.name ?? '未加载'} · 选中：{selectedElement?.name ?? '无'}</div>
          </div>
          <div className="topbar-actions">
            <button className="export-btn" onClick={exportHtml}>导出当前页 HTML</button>
            <ToolbarButton label="保存项目 JSON" onClick={exportJson} />
          </div>
        </div>

        <div className="page-tabs">
          {project.pages.map((page) => (
            <button key={page.id} className={`tab ${project.activePageId === page.id ? 'active' : ''}`} onClick={() => selectPage(page.id)}>{page.name}</button>
          ))}
        </div>

        <div className="editor-actions">
          <ActionButton label="新增文本" onClick={addText} />
          <ActionButton label="新增形状" onClick={addShape} />
          <ActionButton label="复制选中" onClick={duplicateElement} disabled={!selectedElement || selectedElement.locked} />
          <ActionButton label="删除选中" onClick={removeElement} disabled={!selectedElement || selectedElement.locked} />
          <ActionButton label="上移图层" onClick={() => changeLayer(-1)} disabled={!selectedElement || selectedElement.locked} />
          <ActionButton label="下移图层" onClick={() => changeLayer(1)} disabled={!selectedElement || selectedElement.locked} />
          <ActionButton label="撤销" onClick={undo} disabled={!history.length} />
          <ActionButton label="重做" onClick={redo} disabled={!future.length} />
          <ActionButton label="重置视图" onClick={() => setZoom(0.62)} />
          <ActionButton label="放大" onClick={() => setZoom((z) => clamp(z + 0.08, 0.35, 1.0))} />
          <ActionButton label="缩小" onClick={() => setZoom((z) => clamp(z - 0.08, 0.35, 1.0))} />
        </div>

        <div
          className="canvas-stage"
          ref={previewRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelectedElementId('');
          }}
        >
          <div className="canvas-page" style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${zoom})` }}>
            <div className="grid-overlay" />
            <div className="page-hint">当前页：{activePage?.name}</div>
            {activePage?.elements
              .slice()
              .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
              .map((el) => {
                const isSelected = el.id === selectedElement?.id;
                return (
                  <div
                    key={el.id}
                    className={`canvas-el kind-${el.kind} ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
                    style={{
                      left: el.x,
                      top: el.y,
                      width: el.w,
                      height: el.h,
                      background: el.kind === 'shape' ? (el.bgColor ?? 'transparent') : 'transparent',
                      color: el.color ?? '#17202b',
                      borderRadius: el.radius ?? 0,
                      opacity: el.opacity ?? 1,
                      zIndex: el.zIndex ?? 0,
                      fontSize: el.fontSize ?? 28,
                      fontWeight: el.fontWeight ?? 700,
                      lineHeight: el.lineHeight ?? 1.5,
                      letterSpacing: `${el.letterSpacing ?? 0}px`,
                      textAlign: el.align ?? 'left',
                      whiteSpace: el.kind === 'text' ? 'pre-wrap' : 'normal',
                      overflowWrap: el.kind === 'text' ? 'anywhere' : 'normal',
                      wordBreak: el.kind === 'text' ? 'break-word' : 'normal',
                      transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined,
                      border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor ?? '#000'}` : undefined
                    }}
                    onPointerDown={(e) => onPointerDownElement(e, el, 'move')}
                  >
                    {el.kind === 'image' ? (
                      <img src={project.assets.find((a) => a.id === el.assetId)?.url ?? el.sourceUrl ?? ''} alt={el.name} />
                    ) : el.kind === 'text' ? (
                      <div className="canvas-text">{el.text}</div>
                    ) : null}
                    {isSelected && !el.locked ? <div className="resize-handle" onPointerDown={(e) => onPointerDownElement(e, el, 'resize-br')} /> : null}
                  </div>
                );
              })}
          </div>
          {warnings.length ? <div className="warning-badge">{warnings.join(' · ')}</div> : null}
        </div>
      </main>

      <aside className="sidebar right">
        <div className="panel-title">属性面板</div>
        {selectedElement ? (
          <>
            <div className="info-line">当前选中：{selectedElement.name}</div>
            <SlotEditor label="元素名称" value={selectedElement.name} onChange={(next) => updateSelected({ name: next })} />
            {selectedElement.kind === 'text' ? <SlotEditor label="文本内容" value={selectedElement.text ?? ''} onChange={(next) => updateSelected({ text: next })} /> : null}
            {selectedElement.kind === 'shape' ? <div className="info-line">当前为形状元素，可调颜色、圆角和层级。</div> : null}
            {selectedElement.kind === 'image' ? (
              <>
                <div className="info-line">图片绑定：{selectedImageAsset?.name ?? '未绑定'}</div>
                <SelectField
                  label="替换图片"
                  value={selectedElement.assetId ?? ''}
                  onChange={(next) => updateSelected({ assetId: next })}
                  options={project.assets.map((asset) => ({ value: asset.id, label: asset.name }))}
                />
              </>
            ) : null}
            <div className="panel-title" style={{ marginTop: 18 }}>位置与尺寸</div>
            <div className="layout-grid">
              <NumberField label="X" value={selectedElement.x} onChange={(n) => updateSelected({ x: n })} />
              <NumberField label="Y" value={selectedElement.y} onChange={(n) => updateSelected({ y: n })} />
              <NumberField label="W" value={selectedElement.w} onChange={(n) => updateSelected({ w: n })} />
              <NumberField label="H" value={selectedElement.h} onChange={(n) => updateSelected({ h: n })} />
            </div>
            <div className="layout-grid">
              <NumberField label="字号" value={selectedElement.fontSize ?? 28} onChange={(n) => updateSelected({ fontSize: n })} />
              <NumberField label="权重" value={selectedElement.fontWeight ?? 700} onChange={(n) => updateSelected({ fontWeight: n })} />
              <NumberField label="圆角" value={selectedElement.radius ?? 0} onChange={(n) => updateSelected({ radius: n })} />
              <NumberField label="透明度" value={Math.round((selectedElement.opacity ?? 1) * 100)} onChange={(n) => updateSelected({ opacity: clamp(n / 100, 0, 1) })} />
            </div>
            <div className="layout-grid">
              <NumberField label="层级" value={selectedElement.zIndex ?? 0} onChange={(n) => updateSelected({ zIndex: n })} />
              <NumberField label="旋转" value={selectedElement.rotate ?? 0} onChange={(n) => updateSelected({ rotate: n })} />
            </div>
            <div className="panel-title" style={{ marginTop: 18 }}>微调移动</div>
            <div className="layout-grid">
              <ActionButton label="上移 1" onClick={() => moveSelected(0, -1)} />
              <ActionButton label="下移 1" onClick={() => moveSelected(0, 1)} />
              <ActionButton label="左移 1" onClick={() => moveSelected(-1, 0)} />
              <ActionButton label="右移 1" onClick={() => moveSelected(1, 0)} />
            </div>
            <div className="info-line" style={{ marginTop: 10 }}>快捷键：{`Ctrl/Cmd+Z`} 撤销，{`Ctrl/Cmd+Shift+Z`} 或 {`Ctrl/Cmd+Y`} 重做。</div>
          </>
        ) : (
          <div className="info-line">点击画布里的元素进行编辑。</div>
        )}

        <div className="panel-title" style={{ marginTop: 18 }}>页面列表</div>
        <div className="bind-list page-thumbs">
          {project.pages.map((page) => {
            const thumb = getPageThumbnail(page, project.assets);
            return (
              <button key={page.id} className={`bind-item page-thumb ${project.activePageId === page.id ? 'active' : ''}`} onClick={() => selectPage(page.id)}>
                <div className="page-thumb-preview">
                  {thumb.imageUrl ? <img src={thumb.imageUrl} alt={page.name} /> : <div className="page-thumb-placeholder">{page.name.slice(0, 2)}</div>}
                </div>
                <div className="page-thumb-meta">
                  <div className="page-thumb-title">{page.name}</div>
                  <div className="page-thumb-text">{thumb.title || thumb.body || '无摘要'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
