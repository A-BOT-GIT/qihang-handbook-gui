import type { CssRule, CssDeclaration, CssStylesheet } from '../types';

/**
 * 将 CssRule[] 序列化为完整的 CSS 文本（用于导出到 <style> 块）
 * 保留 at-rules 的原始文本
 */
export function serializeStylesheet(stylesheet: CssStylesheet): string {
  const parts: string[] = [];

  // 规则（按 order 排序）
  if (stylesheet.rules.length) {
    const ruleBlocks = stylesheet.rules
      .sort((a, b) => a.order - b.order)
      .map((rule) => {
        const declLines = rule.declarations.map((d) => {
          const important = d.important ? ' !important' : '';
          return `  ${d.property}: ${d.value}${important};`;
        });
        return `${rule.selector} {\n${declLines.join('\n')}\n}`;
      });
    parts.push(ruleBlocks.join('\n\n'));
  }

  // at-rules（按 order 插入）
  if (stylesheet.atRules.length) {
    const sortedAtRules = [...stylesheet.atRules].sort((a, b) => a.order - b.order);
    for (const atRule of sortedAtRules) {
      parts.push(atRule.rawText);
    }
  }

  return parts.join('\n\n');
}

/**
 * 将 CssDeclaration[] 序列化为 style 属性字符串
 */
export function serializeInlineStyles(
  declarations: CssDeclaration[]
): string {
  if (!declarations.length) return '';
  return declarations
    .map((d) => {
      const important = d.important ? ' !important' : '';
      return `${d.property}: ${d.value}${important}`;
    })
    .join('; ');
}

/**
 * 生成完整的 <style> HTML 标签
 */
export function renderStyleTag(stylesheet: CssStylesheet): string {
  const css = serializeStylesheet(stylesheet);
  if (!css) return '';
  return `<style>\n${css}\n</style>`;
}
