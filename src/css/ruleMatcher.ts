import type { CssRule } from '../types';

/**
 * 获取所选元素匹配的所有样式表规则（按源码顺序）
 * 使用浏览器的原生选择器引擎进行匹配
 */
export function matchRulesToElement(
  element: HTMLElement,
  rules: CssRule[]
): CssRule[] {
  return rules.filter((rule) => {
    try {
      return element.matches(rule.selector);
    } catch {
      // 无效选择器 — 跳过
      return false;
    }
  });
}

/**
 * 获取文档中匹配指定规则的所有元素
 */
export function matchElementsForRule(
  doc: Document,
  rule: CssRule
): HTMLElement[] {
  try {
    return Array.from(doc.querySelectorAll(rule.selector)) as HTMLElement[];
  } catch {
    return [];
  }
}

/**
 * 生成元素的可读选择器描述
 */
export function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = element.classList.length
    ? '.' + Array.from(element.classList).slice(0, 3).join('.')
    : '';
  return `${tag}${id}${classes}`;
}
