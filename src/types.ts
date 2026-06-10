export type Asset = {
  id: string;
  name: string;
  url: string;
  size?: string;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ElementKind = 'text' | 'image' | 'shape';
export type ElementShape = 'rect' | 'pill' | 'line';
export type TextAlign = 'left' | 'center' | 'right';

// ── CSS 类型 ──

/** 单个 CSS 声明 (property: value) */
export type CssDeclaration = {
  property: string;
  value: string;
  important: boolean;
};

/** 完整的 CSS 规则 (选择器 + 声明块) */
export type CssRule = {
  id: string;
  selector: string;
  declarations: CssDeclaration[];
  source: 'stylesheet' | 'inline';
  order: number;
};

/** 从 <style> 块提取的样式表 */
export type CssStylesheet = {
  rules: CssRule[];
  atRules: CssAtRule[];  // @media / @keyframes 等（保留原始文本）
  rawText: string;
};

/** 保留的 at-rule（@media、@keyframes 等，不做深度解析） */
export type CssAtRule = {
  name: string;        // 如 "media"、"keyframes"
  prelude: string;     // 如 "screen and (max-width: 1180px)"
  rawText: string;     // 完整原始文本（含嵌套规则）
  order: number;
};

// ── 页面元素 ──

export type PageElement = Rect & {
  id: string;
  kind: ElementKind;
  name: string;
  text?: string;
  assetId?: string;
  sourceUrl?: string;
  bgColor?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  align?: TextAlign;
  opacity?: number;
  rotate?: number;
  shape?: ElementShape;
  zIndex?: number;
  locked?: boolean;
  slot?: string;
  // ── V3 新增：CSS 元数据 ──
  cssClasses: string[];
  cssId: string;
  inlineStyles: CssDeclaration[];
};

export type PageDefinition = {
  id: string;
  name: string;
  template: string;
  templateHtml?: string;
  sourceDocumentHtml?: string;
  elements: PageElement[];
  // ── V3 新增：样式表 ──
  stylesheet: CssStylesheet;
  hasTemplateSlotSyntax: boolean;
};

export type ProjectState = {
  projectName: string;
  assets: Asset[];
  activePageId: string;
  pages: PageDefinition[];
};
