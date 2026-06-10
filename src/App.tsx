import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultProject } from './data';
import { Asset, CssDeclaration, CssRule, PageElement, PageDefinition, ProjectState, Rect } from './types';
import { parseStyleBlock } from './css/parser';
import { extractInlineStyles, extractElementClasses, extractElementId, parseLengthFromInline } from './css/inlineExtractor';
import { matchRulesToElement, matchElementsForRule, describeElement } from './css/ruleMatcher';
import { serializeInlineStyles, renderStyleTag } from './css/serializer';
import { extractRulesFromIframe } from './css/cssomBridge';

const CANVAS_W = 1600;
const CANVAS_H = 2400;
const MIN_SIZE = 24;

type DragMode = 'move' | 'resize-br' | null;
type Point = { x: number; y: number };

// ── CSS 编辑器状态 ──
type CssEditorState = {
  color: string; backgroundColor: string; fontSize: string; fontWeight: string;
  lineHeight: string; letterSpacing: string; textAlign: string; width: string;
  height: string; marginTop: string; marginBottom: string; padding: string;
  borderRadius: string; borderWidth: string; borderColor: string; opacity: string;
  transform: string; display: string;
};

const DEFAULT_CSS_STATE: CssEditorState = {
  color: '', backgroundColor: '', fontSize: '', fontWeight: '',
  lineHeight: '', letterSpacing: '', textAlign: 'left', width: '',
  height: '', marginTop: '', marginBottom: '', padding: '',
  borderRadius: '', borderWidth: '', borderColor: '', opacity: '',
  transform: '', display: '',
};

// ── 工具函数 ──
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function escapeHtml(s: string) { return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string)); }
function stripHtml(s: string) { return s.replace(/<[^>]*>/g, ''); }
function uid(p: string) { return `${p}-${Math.random().toString(16).slice(2)}`; }
function clonePage(p: PageDefinition): PageDefinition { return { ...p, elements: p.elements.map(e => ({ ...e, inlineStyles: [...e.inlineStyles], cssClasses: [...e.cssClasses] })), stylesheet: { ...p.stylesheet, rules: p.stylesheet.rules.map(r => ({ ...r, declarations: [...r.declarations] })) } }; }
function cloneProject(s: ProjectState): ProjectState { return { ...s, assets: s.assets.map(a => ({ ...a })), pages: s.pages.map(clonePage) }; }
function getById(page: PageDefinition, id: string) { return page.elements.find(e => e.id === id); }
function inferMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) { case 'jpg': case 'jpeg': return 'image/jpeg'; case 'webp': return 'image/webp'; case 'gif': return 'image/gif'; case 'svg': return 'image/svg+xml'; default: return 'image/png'; }
}
function normName(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

// ── 共享 UI 组件 ──
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field compact"><span>{label}</span>{children}</label>;
}

function CssField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <label className="field compact"><span>{label}</span><input type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <label className="field compact"><span>{label}</span><input type="number" value={Number.isFinite(value) ? value : 0} onChange={e => onChange(Number(e.target.value))} /></label>;
}

function SlotEditor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="field"><span>{label}</span><textarea value={value} rows={3} onChange={e => onChange(e.target.value)} /></label>;
}

function extractCssState(el: HTMLElement | null): CssEditorState {
  if (!el) return DEFAULT_CSS_STATE;
  const s = (el.ownerDocument?.defaultView ?? window).getComputedStyle(el);
  return {
    color: s.color, backgroundColor: s.backgroundColor, fontSize: s.fontSize,
    fontWeight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
    textAlign: s.textAlign, width: s.width, height: s.height,
    marginTop: s.marginTop, marginBottom: s.marginBottom, padding: s.padding,
    borderRadius: s.borderRadius, borderWidth: s.borderWidth, borderColor: s.borderColor,
    opacity: s.opacity, transform: s.transform === 'none' ? '' : s.transform, display: s.display,
  };
}

// ── V3: HTML 导入管线（CSS 感知）──
function parseHtmlTemplate(name: string, html: string): PageDefinition[] {
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (doc.body?.querySelector('parsererror')) return [buildFallbackPage(name, title, html)];

  // ★ 提取所有 <style> 块
  const styleBlocks = Array.from(doc.querySelectorAll('style'));
  let combinedCss = '';
  styleBlocks.forEach(el => { combinedCss += (el.textContent || '') + '\n'; });
  const stylesheet = combinedCss.trim() ? parseStyleBlock(combinedCss) : { rules: [], atRules: [], rawText: '' };

  // ★ 识别 .sheet 或 .page 作为页面容器，取最外层
  const rawNodes = Array.from(doc.querySelectorAll('.sheet, .page'));
  // 只保留不被其他 .sheet/.page 元素包含的顶层节点
  const topLevelPages = rawNodes.filter(n =>
    !rawNodes.some(other => other !== n && other.contains(n))
  );
  const nodes = topLevelPages.length ? topLevelPages : Array.from(doc.body?.children ?? []).filter(n => !['STYLE', 'SCRIPT'].includes(n.tagName));
  if (!nodes.length) return [buildFallbackPage(name, title, html)];

  return nodes.map((node, i) => buildPageFromNode(name, title, node.outerHTML, html, node, i, stylesheet));
}

function buildFallbackPage(name: string, title: string | undefined, html: string): PageDefinition {
  return {
    id: uid(normName(title ?? name)),
    name: stripHtml(name) || normName(title ?? name),
    template: normName(title ?? name),
    templateHtml: html,
    sourceDocumentHtml: html,
    stylesheet: { rules: [], atRules: [], rawText: '' },
    hasTemplateSlotSyntax: false,
    elements: [{
      id: 'slot-title-0', slot: 'title', kind: 'text', name: '标题',
      text: title ?? '新模板', x: 150, y: 220, w: 760, h: 150,
      fontSize: 88, fontWeight: 900, lineHeight: 1.05, color: '#17202b',
      zIndex: 2, locked: false, cssClasses: [], cssId: '', inlineStyles: [],
    }]
  };
}

function buildPageFromNode(name: string, title: string | undefined, originalHtml: string, sourceDocumentHtml: string, node: Element, index: number, stylesheet: ReturnType<typeof parseStyleBlock>): PageDefinition {
  const label = node.getAttribute('data-page-name') || node.getAttribute('aria-label') || node.id || `${title ?? name} - ${index + 1}`;
  const imgNodes = Array.from(node.querySelectorAll('img'));
  const textNodes = Array.from(node.querySelectorAll('[class*="title"], [class*="subtitle"], [class*="body"], [class*="contact"], [class*="desc"], [class*="caption"], [class*="text"], [class*="badge"], [class*="chip"], [class*="bullet"], [class*="big"], [class*="lead"], [class*="label"], h1, h2, h3, h4, h5, h6, p, blockquote, li, figcaption'));

  const elements: PageElement[] = [];

  textNodes.forEach((tn, ti) => {
    const t = stripHtml(tn.textContent || '');
    if (!t) return;
    const inlineStyles = extractInlineStyles(tn);
    const cssClasses = extractElementClasses(tn);
    const cssId = extractElementId(tn);
    const cls = cssClasses.join(' ');
    const tag = tn.tagName.toLowerCase();
    const isTitle = /title/i.test(cls) || tag === 'h1';
    const isSub = /subtitle/i.test(cls) || tag === 'h2';
    const isBody = /body|text|desc/i.test(cls) || tag === 'p';
    const isContact = /contact/i.test(cls);

    // ★ 从真实CSS读取位置和样式
    const x = parseLengthFromInline(inlineStyles, 'left') ?? 120 + ti * 20;
    const y = parseLengthFromInline(inlineStyles, 'top') ?? 120 + ti * 110;
    const w = parseLengthFromInline(inlineStyles, 'width') ?? 760;
    const h = parseLengthFromInline(inlineStyles, 'height') ?? (isTitle ? 150 : isSub ? 56 : isContact ? 80 : 120);
    const fs = parseLengthFromInline(inlineStyles, 'font-size') ?? (isTitle ? 88 : isSub ? 34 : 28);
    const fw = parseLengthFromInline(inlineStyles, 'font-weight') ?? (isTitle ? 900 : 700);
    const lh = parseLengthFromInline(inlineStyles, 'line-height') ?? (isBody ? 1.6 : 1.25);

    elements.push({
      id: `slot-text-${index}-${ti}`,
      slot: isTitle ? 'title' : isSub ? 'subtitle' : isBody ? 'body' : isContact ? 'contact' : `text_${ti}`,
      kind: 'text',
      name: isTitle ? '标题' : isSub ? '副标题' : isBody ? '正文' : isContact ? '联系信息' : `文本 ${ti + 1}`,
      text: t, x, y, w, h, fontSize: fs, fontWeight: fw, lineHeight: lh,
      color: isContact ? '#ffffff' : '#17202b', zIndex: 2, locked: false,
      cssClasses, cssId, inlineStyles,
    });
  });

  imgNodes.forEach((img, ii) => {
    const src = img.getAttribute('src') || '';
    const inlineStyles = extractInlineStyles(img);
    const cssClasses = extractElementClasses(img);
    const cssId = extractElementId(img);
    const x = parseLengthFromInline(inlineStyles, 'left') ?? 900 + ii * 40;
    const y = parseLengthFromInline(inlineStyles, 'top') ?? 220 + ii * 40;
    const w = parseLengthFromInline(inlineStyles, 'width') ?? 580;
    const h = parseLengthFromInline(inlineStyles, 'height') ?? 780;

    elements.push({
      id: `slot-image-${index}-${ii}`,
      slot: `image_${ii}`, kind: 'image', name: `图片 ${ii + 1}`,
      sourceUrl: src, x, y, w, h, radius: 32, zIndex: 3, locked: false,
      cssClasses, cssId, inlineStyles,
    });
  });

  return {
    id: uid(normName(label)),
    name: stripHtml(label),
    template: normName(title ?? name),
    templateHtml: originalHtml,
    sourceDocumentHtml,
    stylesheet,
    hasTemplateSlotSyntax: /{{/.test(originalHtml),
    elements,
  };
}

// ── HTML 构建（带样式表序列化）──
function buildHtml(page: PageDefinition, assets: Asset[]): string {
  const styleTag = renderStyleTag(page.stylesheet);
  const els = [...page.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"/>
${styleTag}
<style>
html,body{margin:0;padding:0;width:100%;min-height:100vh;background:rgba(0,0,0,0.03);}
.page{position:relative;width:var(--canvas-w,1600px);min-height:var(--canvas-h,2400px);margin:0 auto;background:#fbf8f2;overflow:hidden;}
.el{position:absolute;overflow:hidden;}
.text{word-break:break-word;line-height:1.25;margin:0;}
.image img{width:100%;height:100%;object-fit:cover;display:block;}
</style>
</head>
<body style="--canvas-w:${CANVAS_W}px;--canvas-h:${CANVAS_H}px;">
<div class="page">
${els.map(el => renderElement(el, assets)).join('\n')}
</div>
</body>
</html>`;
}

function renderElement(el: PageElement, assets: Asset[]): string {
  const asset = assets.find(a => a.id === el.assetId);
  const bgImg = asset ? ` background-image:url(${escapeHtml(asset.url)});` : '';
  const bg = el.bgColor ? `background-color:${el.bgColor};` : '';
  const inlineStr = serializeInlineStyles(el.inlineStyles);
  const classStr = el.cssClasses.length ? ` class="${el.cssClasses.join(' ')}"` : '';
  const idStr = el.cssId ? ` id="${el.cssId}"` : '';

  const base = `left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;`;
  const radius = el.radius ? `border-radius:${el.radius}px;` : '';
  const opacity = el.opacity != null ? `opacity:${el.opacity};` : '';
  const rotate = el.rotate ? `transform:rotate(${el.rotate}deg);` : '';
  let extra = bg + bgImg + radius + opacity + rotate;

  if (el.kind === 'text') {
    const fs = el.fontSize ? `font-size:${el.fontSize}px;` : '';
    const fw = el.fontWeight ? `font-weight:${el.fontWeight};` : '';
    const lh = el.lineHeight ? `line-height:${el.lineHeight};` : '';
    const c = el.color ? `color:${el.color};` : '';
    const ls = el.letterSpacing ? `letter-spacing:${el.letterSpacing}px;` : '';
    const ta = el.align ? `text-align:${el.align};` : '';
    return `<div${idStr}${classStr} class="el text" style="${base}${extra}${fs}${fw}${lh}${c}${ls}${ta}${inlineStr ? inlineStr : ''}">${escapeHtml(el.text || '')}</div>`;
  }
  if (el.kind === 'image') {
    const imgEl = asset ? `<img src="${escapeHtml(asset.url)}" alt="${escapeHtml(el.name)}"/>` : '';
    return `<div${idStr}${classStr} class="el image" style="${base}${extra}${inlineStr ? inlineStr : ''}">${imgEl}</div>`;
  }
  // shape
  const bw = el.borderWidth ? `border:${el.borderWidth}px solid ${el.borderColor || '#ccc'};` : '';
  const shape = el.shape === 'pill' ? 'border-radius:999px;' : el.shape === 'line' ? `height:${el.h}px;` : '';
  return `<div${idStr}${classStr} class="el" style="${base}${extra}${bw}${shape}${inlineStr ? inlineStr : ''}"></div>`;
}

function renderTemplate(html: string, page: PageDefinition, assets: Asset[]): string {
  let result = html;
  page.elements.forEach(el => {
    if (el.slot) {
      const re = new RegExp(`{{${el.slot}}}`, 'g');
      result = result.replace(re, (el.kind === 'image' && el.assetId)
        ? assets.find(a => a.id === el.assetId)?.url ?? ''
        : el.text ?? '');
    }
  });
  return result;
}

function injectStylesIntoHtml(html: string, styleTag: string, baseHref?: string): string {
  const next = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const baseTag = baseHref ? `<base href="${baseHref}">` : '';
  if (/<\/head>/i.test(next)) {
    const withoutBase = next.replace(/<base\b[^>]*>/gi, '');
    return withoutBase.replace(/<\/head>/i, `${baseTag}\n${styleTag}\n</head>`);
  }
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">${baseTag}${styleTag}</head><body>${next}</body></html>`;
}

// ═══════════════════════════════════════════
// 主应用组件
// ═══════════════════════════════════════════
export default function App() {
  const [project, setProject] = useState<ProjectState>(defaultProject);
  const [selectedId, setSelectedId] = useState<string>('brand-title');
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [startRect, setStartRect] = useState<Rect | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0.62);
  const [history, setHistory] = useState<ProjectState[]>([]);
  const [future, setFuture] = useState<ProjectState[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [cssTab, setCssTab] = useState<'inspector' | 'rules' | 'source'>('inspector');
  const [htmlDraft, setHtmlDraft] = useState('');
  const [cssSource, setCssSource] = useState('');
  const [selectedCss, setSelectedCss] = useState<CssEditorState>(DEFAULT_CSS_STATE);
  const [selectedClassStr, setSelectedClassStr] = useState('');
  const [selLabel, setSelLabel] = useState('未选择 iframe 元素');
  const [ruleFilter, setRuleFilter] = useState('');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingSelector, setEditingSelector] = useState('');
  const [editingDecls, setEditingDecls] = useState<CssDeclaration[]>([]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const activePage = useMemo(() => project.pages.find(p => p.id === project.activePageId) ?? project.pages[0], [project.activePageId, project.pages]);
  const selectedEl = activePage?.elements.find(e => e.id === selectedId);
  const selectedAssetId = selectedEl?.assetId ?? activePage?.elements.find(e => e.kind === 'image')?.assetId;
  const activeAsset = project.assets.find(a => a.id === selectedAssetId) ?? project.assets[0];

  const pushHistory = (next: ProjectState) => {
    setHistory(h => [...h, cloneProject(project)].slice(-50));
    setProject(next);
    setFuture([]);
  };
  const patch = (updater: (s: ProjectState) => ProjectState) => pushHistory(updater(cloneProject(project)));
  const updateActive = (updater: (p: PageDefinition) => PageDefinition) => patch(s => ({ ...s, pages: s.pages.map(p => p.id === s.activePageId ? updater(clonePage(p)) : p) }));
  const updateEl = (id: string, p: Partial<PageElement>) => updateActive(page => ({ ...page, elements: page.elements.map(e => e.id === id ? { ...e, ...p } : e) }));
  const updateSel = (p: Partial<PageElement>) => { if (selectedEl) updateEl(selectedEl.id, p); };

  const undo = () => setHistory(h => {
    if (!h.length) return h;
    const snap = h[h.length - 1];
    setProject(cur => { setFuture(f => [cloneProject(cur), ...f].slice(-50)); return snap; });
    return h.slice(0, -1);
  });
  const redo = () => setFuture(f => {
    if (!f.length) return f;
    const snap = f[0];
    setHistory(h => [...h, cloneProject(project)].slice(-50));
    setProject(snap);
    return f.slice(1);
  });

  useEffect(() => {
    if (!activePage) return;
    if (selectedId && activePage.elements.some(e => e.id === selectedId)) return;
    const next = activePage.elements.find(e => e.id.includes('title'))?.id ?? activePage.elements.find(e => e.kind === 'image')?.id ?? activePage.elements[0]?.id ?? '';
    if (next) setSelectedId(next);
  }, [activePage, selectedId]);

  useEffect(() => {
    fetch('./html/handbook-template.html')
      .then(r => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(html => {
        const imported = parseHtmlTemplate('handbook-template.html', html);
        if (!imported.length) return;
        setProject(prev => ({ ...prev, pages: imported, activePageId: imported[0].id }));
        setSelectedId(imported[0].elements.find(e => e.id.includes('title'))?.id ?? imported[0].elements[0]?.id ?? '');
      })
      .catch(() => {
        // Keep the built-in fallback project when the standalone template is unavailable.
      });
  }, []);

  // iframe 选择逻辑
  const selectIframeElement = (el: HTMLElement) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const doc = iframe.contentDocument;
    doc.querySelectorAll('[data-css-editor-selected="true"]').forEach(e => e.removeAttribute('data-css-editor-selected'));
    el.setAttribute('data-css-editor-selected', 'true');
    setSelLabel(describeElement(el));
    setSelectedCss(extractCssState(el));
    setSelectedClassStr(el.className?.replace('el', '').trim() || '');
  };

  const clearIframeSelection = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    iframe.contentDocument.querySelectorAll('[data-css-editor-selected="true"]').forEach(e => e.removeAttribute('data-css-editor-selected'));
    setSelLabel('未选择 iframe 元素');
    setSelectedCss(DEFAULT_CSS_STATE);
    setSelectedClassStr('');
  };

  const applyCssToIframe = (el: HTMLElement, patch: Record<string, string>) => {
    Object.entries(patch).forEach(([k, v]) => {
      if (v !== '' && v != null) {
        const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
        try { (el.style as any)[k] = v; } catch {}
      }
    });
  };

  // 导入文件处理
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const htmlFiles = Array.from(files).filter(f => /\.html?$/i.test(f.name));
    const imgFiles = Array.from(files).filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name));
    if (htmlFiles.length) {
      Promise.all(htmlFiles.map(f => f.text())).then(texts => {
        const imported = texts.flatMap((html, i) => parseHtmlTemplate(htmlFiles[i].name, html));
        patch(prev => ({ ...prev, pages: [...imported, ...prev.pages], activePageId: imported[0]?.id ?? prev.activePageId }));
        setWarnings([]);
      });
    }
    if (imgFiles.length) {
      const assets: Asset[] = imgFiles.map(f => ({ id: uid(f.name), name: f.name, url: URL.createObjectURL(f), size: `${Math.round(f.size / 1024)} KB` }));
      patch(prev => ({ ...prev, assets: [...assets, ...prev.assets] }));
    }
  };

  // Electron 导入
  const importFromPaths = async (paths: string[], type: 'html' | 'image') => {
    const api = (window as any).electronAPI;
    if (!api || !paths.length) return;
    if (type === 'html') {
      const results = await Promise.all(paths.map(async (fp: string) => {
        const content = await api.readFile(fp);
        return { name: fp.split(/[/\\]/).pop() || 't.html', content };
      }));
      const imported = results.flatMap(r => parseHtmlTemplate(r.name, r.content));
      patch(prev => ({ ...prev, pages: [...imported, ...prev.pages], activePageId: imported[0]?.id ?? prev.activePageId }));
    } else {
      const results = await Promise.all(paths.map(async (fp: string) => api.readBinaryFile(fp)));
      const assets: Asset[] = results.filter(Boolean).map((r: any) => ({ id: uid(r.name), name: r.name, url: `data:${inferMime(r.name)};base64,${r.data}` }));
      patch(prev => ({ ...prev, assets: [...assets, ...prev.assets] }));
    }
  };

  // 导出
  const exportHtml = () => {
    const html = activePage?.sourceDocumentHtml
      ? injectStylesIntoHtml(activePage.sourceDocumentHtml, renderStyleTag(activePage.stylesheet), './')
      : activePage?.templateHtml && activePage.hasTemplateSlotSyntax
      ? renderTemplate(activePage.templateHtml, activePage, project.assets)
      : buildHtml(activePage, project.assets);
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${activePage.name}.html`; a.click();
  };

  // CSS 样式表修改
  const updateRule = (ruleId: string, updater: (r: CssRule) => CssRule) => {
    updateActive(page => ({
      ...page,
      stylesheet: { ...page.stylesheet, rawText: '', rules: page.stylesheet.rules.map(r => r.id === ruleId ? updater(r) : r) }
    }));
  };

  const addRule = () => {
    const newRule: CssRule = { id: uid('css-rule'), selector: '.new-rule', declarations: [], source: 'stylesheet', order: activePage.stylesheet.rules.length };
    updateActive(page => ({ ...page, stylesheet: { ...page.stylesheet, rawText: '', rules: [...page.stylesheet.rules, newRule] } }));
  };

  const deleteRule = (ruleId: string) => {
    updateActive(page => ({ ...page, stylesheet: { ...page.stylesheet, rawText: '', rules: page.stylesheet.rules.filter(r => r.id !== ruleId) } }));
  };

  const saveRuleEditor = () => {
    if (!editingRuleId) return;
    updateRule(editingRuleId, r => ({ ...r, selector: editingSelector, declarations: editingDecls }));
    setEditingRuleId(null);
  };

  // 内联样式修改
  const applyInlineCss = (prop: string, value: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const el = iframe.contentDocument.querySelector('[data-css-editor-selected="true"]') as HTMLElement | null;
    if (el) applyCssToIframe(el, { [prop]: value });
  };

  const commitInlineCss = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const el = iframe.contentDocument.querySelector('[data-css-editor-selected="true"]') as HTMLElement | null;
    if (!el) return;
    const state = extractCssState(el);
    // 保存到选中元素
    const existingSlots = activePage.elements.filter(e => e.kind === 'text');
    // 尝试找到匹配的 slot 元素
    const matchedEl = existingSlots.find(e => el.textContent?.includes(e.text?.slice(0, 10) || ''));
    if (matchedEl) {
      const newInline: CssDeclaration[] = Object.entries(state).filter(([_, v]) => v).map(([k, v]) => ({ property: k.replace(/([A-Z])/g, '-$1').toLowerCase(), value: String(v), important: false }));
      updateEl(matchedEl.id, { inlineStyles: newInline });
    }
  };

  // 类名编辑
  const updateElementClasses = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const el = iframe.contentDocument.querySelector('[data-css-editor-selected="true"]') as HTMLElement | null;
    if (!el) return;
    const classes = selectedClassStr.split(/\s+/).filter(Boolean);
    el.className = 'el ' + classes.join(' ');
    setSelectedClassStr(classes.join(' '));
  };

  // 初始化 iframe 编辑
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const doc = iframe.contentDocument;
    const setup = () => {
      // 可编辑文本
      doc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,span,div,figcaption,blockquote,td,th,label,a').forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.setAttribute('contenteditable', 'true');
        htmlEl.style.outline = 'none';
        htmlEl.style.cursor = 'text';
        htmlEl.addEventListener('focus', () => selectIframeElement(htmlEl));
        htmlEl.addEventListener('click', (e) => { e.stopPropagation(); selectIframeElement(htmlEl); });
      });
      // 可点击图像
      doc.querySelectorAll('img').forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.cursor = 'pointer';
        htmlEl.addEventListener('click', (e) => { e.stopPropagation(); selectIframeElement(htmlEl); });
      });
      // body 清除选择
      doc.body.addEventListener('click', () => clearIframeSelection());
      // 样式注入
      const s = doc.createElement('style');
      s.textContent = '[contenteditable]:hover{outline:2px dashed rgba(240,154,74,0.5)!important;}[data-css-editor-selected="true"]{outline:3px solid var(--teal,#4ab7b0)!important;background:rgba(74,183,176,0.08);}';
      doc.head.appendChild(s);
    };
    if (doc.readyState === 'complete') setup();
    else doc.addEventListener('DOMContentLoaded', setup);
  }, [activePage?.id, htmlDraft, sourceOpen]);

  // ── 渲染 ──
  const iframeDoc = useMemo(() => {
    if (htmlDraft) return htmlDraft;
    if (activePage?.sourceDocumentHtml) return injectStylesIntoHtml(activePage.sourceDocumentHtml, renderStyleTag(activePage.stylesheet), './html/');
    if (activePage?.templateHtml) return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">${renderStyleTag(activePage.stylesheet)}</head><body>${activePage.templateHtml}</body></html>`;
    return buildHtml(activePage, project.assets);
  }, [htmlDraft, activePage?.id, activePage?.stylesheet, activePage?.templateHtml, activePage?.sourceDocumentHtml, project.assets]);
  const iframeHtml = iframeDoc;
  const matchedRules = iframeRef.current?.contentDocument
    ? matchRulesToElement(
        iframeRef.current.contentDocument.querySelector('[data-css-editor-selected="true"]') as HTMLElement,
        activePage.stylesheet.rules
      )
    : [];

  return (
    <div className="app-shell">
      {/* 左侧栏 */}
      <aside className="sidebar">
        <h2 className="panel-title">📦 资源库</h2>
        <label className="upload"><input type="file" multiple accept=".html,.htm,.png,.jpg,.jpeg,.webp,.gif,.svg" onChange={e => handleFiles(e.target.files)} />📁 导入 HTML / 图片</label>

        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📄 页面 ({project.pages.length})</h3>
        <div className="asset-grid" style={{ marginBottom: 12 }}>
          {project.pages.map(p => (
            <button key={p.id} className={`action-chip${p.id === activePage?.id ? ' active' : ''}`} onClick={() => patch(s => ({ ...s, activePageId: p.id }))} style={{ display: 'block', textAlign: 'left', width: '100%' }}>
              {p.name}
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>规则: {p.stylesheet.rules.length} · 元素: {p.elements.length}</span>
            </button>
          ))}
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🖼️ 素材 ({project.assets.length})</h3>
        <div className="asset-grid">
          {project.assets.map(a => (
            <div key={a.id} className={`asset-card${a.id === activeAsset?.id ? ' active' : ''}`} onClick={() => selectedEl?.kind === 'image' && updateSel({ assetId: a.id })}>
              <img src={a.url} alt={a.name} />
              <span style={{ fontSize: 12 }}>{a.name}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* 中间画布 */}
      <main className="center" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
          <button className="export-btn secondary" onClick={() => setSourceOpen(v => !v)}>{sourceOpen ? '隐藏编辑器' : '🎨 CSS 编辑器'}</button>
          <button className="export-btn secondary" onClick={exportHtml}>📤 导出 HTML</button>
          <span style={{ flex: 1 }} />
          <button className="action-chip" onClick={undo} disabled={!history.length}>↩ 撤销</button>
          <button className="action-chip" onClick={redo} disabled={!future.length}>↪ 重做</button>
          <span style={{ fontSize: 13 }}>🔍 {Math.round(zoom * 100)}%</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: CANVAS_W, minHeight: CANVAS_H, background: '#fbf8f2', borderRadius: 16, boxShadow: '0 12px 48px rgba(0,0,0,0.12)', position: 'relative' }}>
            <iframe ref={iframeRef} srcDoc={iframeHtml} onLoad={() => { const iframe = iframeRef.current; if (!iframe?.contentDocument) return; const doc = iframe.contentDocument; doc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,span,div,figcaption,blockquote,td,th,label,a').forEach(el => { const htmlEl = el as HTMLElement; htmlEl.setAttribute('contenteditable', 'true'); htmlEl.style.outline = 'none'; htmlEl.style.cursor = 'text'; htmlEl.addEventListener('focus', () => selectIframeElement(htmlEl)); htmlEl.addEventListener('click', (e) => { e.stopPropagation(); selectIframeElement(htmlEl); }); }); doc.querySelectorAll('img').forEach(el => { const htmlEl = el as HTMLElement; htmlEl.style.cursor = 'pointer'; htmlEl.addEventListener('click', (e) => { e.stopPropagation(); selectIframeElement(htmlEl); }); }); doc.body.addEventListener('click', () => clearIframeSelection()); const s = doc.createElement('style'); s.textContent = '[contenteditable]:hover{outline:2px dashed rgba(240,154,74,0.5)!important;}[data-css-editor-selected="true"]{outline:3px solid var(--teal,#4ab7b0)!important;background:rgba(74,183,176,0.08);}'; doc.head.appendChild(s); }} style={{ width: '100%', height: CANVAS_H, border: 'none', borderRadius: 16 }} title="preview" />
          </div>
        </div>
      </main>

      {/* 右侧 CSS 编辑器 */}
      <aside className="sidebar" style={{ padding: 18, overflow: 'auto' }}>
        <h2 className="panel-title">🎨 CSS 编辑器</h2>

        {/* 标签页 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {(['inspector', 'rules', 'source'] as const).map(tab => (
            <button key={tab} className={`action-chip${cssTab === tab ? ' active' : ''}`} onClick={() => setCssTab(tab)} style={{ flex: 1 }}>
              {{ inspector: '🔍 检查器', rules: '📋 规则', source: '📝 源码' }[tab]}
            </button>
          ))}
        </div>

        {/* 检查器标签页 */}
        {cssTab === 'inspector' && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>选中: <strong>{selLabel}</strong></p>
            <label className="field compact">
              <span>类名</span>
              <input type="text" value={selectedClassStr} onChange={e => setSelectedClassStr(e.target.value)} onBlur={updateElementClasses} placeholder="class1 class2" />
            </label>

            <h4 style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>匹配的规则 ({matchedRules.length})</h4>
            <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 8 }}>
              {matchedRules.map(r => (
                <div key={r.id} style={{ fontSize: 11, padding: '4px 6px', background: 'rgba(74,183,176,0.06)', borderRadius: 6, marginBottom: 4, fontFamily: 'monospace' }}>
                  <strong>{r.selector}</strong> ({r.declarations.length} 声明)
                </div>
              ))}
              {!matchedRules.length && <p style={{ fontSize: 11, color: 'var(--muted)' }}>无匹配规则</p>}
            </div>

            <h4 style={{ fontSize: 13, fontWeight: 700 }}>内联样式</h4>
            <CssField label="颜色" value={selectedCss.color} onChange={v => { setSelectedCss(s => ({ ...s, color: v })); applyInlineCss('color', v); }} />
            <CssField label="背景色" value={selectedCss.backgroundColor} onChange={v => { setSelectedCss(s => ({ ...s, backgroundColor: v })); applyInlineCss('backgroundColor', v); }} />
            <CssField label="字号" value={selectedCss.fontSize} onChange={v => { setSelectedCss(s => ({ ...s, fontSize: v })); applyInlineCss('fontSize', v); }} />
            <CssField label="字重" value={selectedCss.fontWeight} onChange={v => { setSelectedCss(s => ({ ...s, fontWeight: v })); applyInlineCss('fontWeight', v); }} />
            <CssField label="行高" value={selectedCss.lineHeight} onChange={v => { setSelectedCss(s => ({ ...s, lineHeight: v })); applyInlineCss('lineHeight', v); }} />
            <CssField label="字间距" value={selectedCss.letterSpacing} onChange={v => { setSelectedCss(s => ({ ...s, letterSpacing: v })); applyInlineCss('letterSpacing', v); }} />
            <CssField label="内边距" value={selectedCss.padding} onChange={v => { setSelectedCss(s => ({ ...s, padding: v })); applyInlineCss('padding', v); }} />
            <CssField label="圆角" value={selectedCss.borderRadius} onChange={v => { setSelectedCss(s => ({ ...s, borderRadius: v })); applyInlineCss('borderRadius', v); }} />
            <CssField label="透明度" value={selectedCss.opacity} onChange={v => { setSelectedCss(s => ({ ...s, opacity: v })); applyInlineCss('opacity', v); }} />
            <button className="export-btn secondary" onClick={commitInlineCss} style={{ marginTop: 8 }}>💾 保存内联样式</button>
          </div>
        )}

        {/* 规则列表标签页 */}
        {cssTab === 'rules' && (
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <button className="export-btn secondary" onClick={addRule} style={{ flex: 1 }}>+ 新建规则</button>
            </div>
            <Field label="筛选">
              <input type="text" value={ruleFilter} onChange={e => setRuleFilter(e.target.value)} placeholder="匹配选择器..." style={{ width: '100%', padding: 4 }} />
            </Field>
            <div style={{ maxHeight: 400, overflow: 'auto', marginTop: 8 }}>
              {activePage.stylesheet.rules.filter(r => !ruleFilter || r.selector.includes(ruleFilter)).map(r => {
                const matchCount = iframeRef.current?.contentDocument ? matchElementsForRule(iframeRef.current.contentDocument, r).length : 0;
                return (
                  <div key={r.id} style={{ fontSize: 11, padding: 6, background: editingRuleId === r.id ? 'rgba(240,154,74,0.1)' : 'rgba(0,0,0,0.02)', borderRadius: 6, marginBottom: 4, border: editingRuleId === r.id ? '1px solid var(--accent)' : '1px solid transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontFamily: 'monospace' }}>{r.selector}</strong>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{matchCount} 匹配</span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {r.declarations.slice(0, 3).map(d => `${d.property}: ${d.value};`).join(' ')}
                      {r.declarations.length > 3 && ` +${r.declarations.length - 3} 更多`}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <button className="action-chip" style={{ fontSize: 10 }} onClick={() => { setEditingRuleId(r.id); setEditingSelector(r.selector); setEditingDecls([...r.declarations]); }}>✏️ 编辑</button>
                      <button className="action-chip" style={{ fontSize: 10 }} onClick={() => deleteRule(r.id)}>🗑 删除</button>
                    </div>
                  </div>
                );
              })}
              {!activePage.stylesheet.rules.length && !activePage.stylesheet.atRules.length && <p style={{ fontSize: 12, color: 'var(--muted)' }}>暂无样式规则。导入 HTML 或新建规则。</p>}
            </div>
            {/* at-rules 展示 */}
            {activePage.stylesheet.atRules.length > 0 && (
              <div style={{ marginTop: 8, padding: 8, background: 'rgba(240,154,74,0.06)', borderRadius: 8 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  📦 At-Rules ({activePage.stylesheet.atRules.length})
                </h4>
                {activePage.stylesheet.atRules.map(ar => (
                  <div key={ar.order} style={{ fontSize: 10, fontFamily: 'monospace', padding: '3px 6px', background: 'rgba(0,0,0,0.02)', borderRadius: 4, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    @{ar.name} {ar.prelude} {'{ ... }'}
                  </div>
                ))}
                <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>at-rules 在源码模式下可编辑</p>
              </div>
            )}

            {/* 规则编辑器弹窗 */}
            {editingRuleId && (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.95)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>编辑规则</h4>
                <Field label="选择器">
                  <input type="text" value={editingSelector} onChange={e => setEditingSelector(e.target.value)} style={{ width: '100%', fontFamily: 'monospace', padding: 4 }} />
                </Field>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {editingDecls.map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                      <input type="text" value={d.property} onChange={e => { const next = [...editingDecls]; next[i] = { ...next[i], property: e.target.value }; setEditingDecls(next); }} style={{ width: '42%', fontFamily: 'monospace', fontSize: 11, padding: 2 }} placeholder="属性" />
                      <input type="text" value={d.value} onChange={e => { const next = [...editingDecls]; next[i] = { ...next[i], value: e.target.value }; setEditingDecls(next); }} style={{ width: '42%', fontFamily: 'monospace', fontSize: 11, padding: 2 }} placeholder="值" />
                      <button className="action-chip" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setEditingDecls(prev => prev.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button className="action-chip" onClick={() => setEditingDecls([...editingDecls, { property: '', value: '', important: false }])}>+ 添加声明</button>
                  <button className="export-btn secondary" onClick={saveRuleEditor} style={{ flex: 1 }}>💾 保存规则</button>
                  <button className="action-chip" onClick={() => setEditingRuleId(null)}>取消</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 源码标签页 */}
        {cssTab === 'source' && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
              CSS 源码（{activePage.stylesheet.rules.length} 规则 + {activePage.stylesheet.atRules.length} at-rules）
            </p>
            <textarea
              style={{ width: '100%', height: 300, fontFamily: 'monospace', fontSize: 12, padding: 8, borderRadius: 8, border: '1px solid var(--line)', resize: 'vertical' }}
              value={cssSource || activePage.stylesheet.rawText || (() => { const r = activePage.stylesheet.rules.map(r => `${r.selector} {\n${r.declarations.map(d => `  ${d.property}: ${d.value}${d.important ? ' !important' : ''};`).join('\n')}\n}`).join('\n\n'); const a = activePage.stylesheet.atRules.map(ar => ar.rawText).join('\n\n'); return r + (a ? '\n\n' + a : ''); })()}
              onChange={e => setCssSource(e.target.value)}
              placeholder="在此编辑 CSS 源码..."
            />
            <button className="export-btn secondary" onClick={() => {
              if (cssSource) {
                const parsed = parseStyleBlock(cssSource);
                updateActive(page => ({ ...page, stylesheet: parsed }));
              }
            }} style={{ marginTop: 8 }}>💾 应用 CSS 源码</button>
          </div>
        )}

        {/* 元素属性（始终显示） */}
        {selectedEl && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📐 元素属性: {selectedEl.name}</h3>
            <NumberField label="X" value={selectedEl.x} onChange={v => updateSel({ x: clamp(v, 0, CANVAS_W - selectedEl.w) })} />
            <NumberField label="Y" value={selectedEl.y} onChange={v => updateSel({ y: clamp(v, 0, CANVAS_H - selectedEl.h) })} />
            <NumberField label="宽" value={selectedEl.w} onChange={v => updateSel({ w: Math.max(v, MIN_SIZE) })} />
            <NumberField label="高" value={selectedEl.h} onChange={v => updateSel({ h: Math.max(v, MIN_SIZE) })} />
            {selectedEl.kind === 'text' && (
              <>
                <SlotEditor label="文本" value={selectedEl.text || ''} onChange={v => updateSel({ text: v })} />
                <NumberField label="字号" value={selectedEl.fontSize ?? 0} onChange={v => updateSel({ fontSize: v })} />
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
