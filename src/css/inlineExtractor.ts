import { parseDeclarationList } from './parser';
import type { CssDeclaration } from '../types';

/**
 * 从 HTML 元素的 style 属性提取内联样式声明
 */
export function extractInlineStyles(element: Element): CssDeclaration[] {
  const styleAttr = element.getAttribute('style');
  if (!styleAttr) return [];
  return parseDeclarationList(styleAttr);
}

/**
 * 从 HTML 元素的 class 属性提取类名列表
 */
export function extractElementClasses(element: Element): string[] {
  const classAttr = element.getAttribute('class');
  return classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];
}

/**
 * 从 HTML 元素提取 id
 */
export function extractElementId(element: Element): string {
  return element.getAttribute('id') || '';
}

/**
 * 从内联声明中读取指定属性的值（用于数值解析）
 */
export function parseLengthFromInline(
  declarations: CssDeclaration[],
  property: string
): number | null {
  const decl = declarations.find(
    (d) => d.property === property
  );
  if (!decl) return null;
  const num = parseFloat(decl.value);
  return Number.isFinite(num) ? num : null;
}

/**
 * 从内联声明中读取指定属性的字符串值
 */
export function parseStringFromInline(
  declarations: CssDeclaration[],
  property: string
): string | null {
  const decl = declarations.find(
    (d) => d.property === property
  );
  return decl ? decl.value : null;
}
