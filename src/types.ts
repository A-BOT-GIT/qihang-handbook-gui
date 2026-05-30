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
};

export type PageDefinition = {
  id: string;
  name: string;
  template: string;
  templateHtml?: string;
  elements: PageElement[];
};

export type ProjectState = {
  projectName: string;
  assets: Asset[];
  activePageId: string;
  pages: PageDefinition[];
};
