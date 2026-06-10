import type { CssRule, CssDeclaration } from '../types';

let _bridgeCounter = 0;
function uid(): string {
  return `cssom-${++_bridgeCounter}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * 从 iframe 的 document.styleSheets 读取所有规则
 * 这是备用路径 — css-tree 解析是主要路径
 *
 * 注意：CSSOM 可能不会完美地往返（简写属性被展开等）
 */
export function extractRulesFromIframe(
  iframeDoc: Document
): CssRule[] {
  const rules: CssRule[] = [];
  let order = 0;

  for (const sheet of iframeDoc.styleSheets) {
    try {
      // 跳过跨域样式表
      if (!sheet.cssRules) continue;

      for (const cssRule of sheet.cssRules) {
        if (cssRule instanceof CSSStyleRule) {
          const declarations: CssDeclaration[] = [];
          for (let i = 0; i < cssRule.style.length; i++) {
            const prop = cssRule.style[i];
            declarations.push({
              property: prop,
              value: cssRule.style.getPropertyValue(prop),
              important:
                cssRule.style.getPropertyPriority(prop) === 'important',
            });
          }

          if (declarations.length > 0) {
            rules.push({
              id: uid(),
              selector: cssRule.selectorText,
              declarations,
              source: 'stylesheet',
              order: order++,
            });
          }
        }
        // 未来可以处理 @media、@keyframes 等
      }
    } catch {
      // 跨域样式表在访问 cssRules 时抛出异常
      continue;
    }
  }

  return rules;
}
