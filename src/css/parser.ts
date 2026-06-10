import * as cssTree from 'css-tree';
import type { CssRule, CssDeclaration, CssAtRule, CssStylesheet } from '../types';

let _ruleCounter = 0;
function uid(): string {
  return `css-rule-${++_ruleCounter}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * 解析 <style> 文本为结构化 CssRule[] + 保留的 at-rules
 * 使用 css-tree 进行完整的 CSS 语法解析
 */
export function parseStyleBlock(cssText: string): CssStylesheet {
  const rawText = cssText.trim();
  if (!rawText) return { rules: [], atRules: [], rawText: '' };

  let ast: cssTree.CssNode;
  try {
    ast = cssTree.parse(rawText, {
      parseAtrulePrelude: true,
      parseRulePrelude: true,
      parseValue: true,
    });
  } catch {
    return { rules: [], atRules: [], rawText };
  }

  const rules: CssRule[] = [];
  const atRules: CssAtRule[] = [];
  let order = 0;

  // 遍历 AST 提取规则和 at-rule
  cssTree.walk(ast, function (node) {
    if (node.type === 'Rule') {
      const ruleNode = node as cssTree.Rule;
      if (!ruleNode.prelude || !ruleNode.block) return;

      let selector: string;
      try {
        selector = cssTree.generate(ruleNode.prelude);
      } catch {
        return;
      }

      const declarations: CssDeclaration[] = [];
      cssTree.walk(ruleNode.block, {
        visit: 'Declaration',
        enter(declNode) {
          const decl = declNode as cssTree.Declaration;
          let value: string;
          try {
            value = cssTree.generate(decl.value);
          } catch {
            value = String(decl.value);
          }
          declarations.push({
            property: decl.property,
            value,
            important: decl.important || false,
          });
        },
      });

      if (declarations.length > 0) {
        rules.push({
          id: uid(),
          selector,
          declarations,
          source: 'stylesheet',
          order: order++,
        });
      }
    }

    // 只提取顶层的 at-rules（不递归处理嵌套 at-rules 内部的 at-rules）
    if (node.type === 'Atrule') {
      const atNode = node as cssTree.Atrule;
      let prelude: string;
      try {
        prelude = atNode.prelude
          ? cssTree.generate(atNode.prelude)
          : '';
      } catch {
        prelude = '';
      }

      let atRawText: string;
      try {
        atRawText = cssTree.generate(atNode);
      } catch {
        // 如果 css-tree 无法生成，就用原始文本中的位置提取
        atRawText = `@${atNode.name} ${prelude} { /* ... */ }`;
      }

      atRules.push({
        name: atNode.name,
        prelude,
        rawText: atRawText,
        order: order++,
      });
    }
  });

  return { rules, atRules, rawText };
}

/**
 * 解析单条声明列表（如 style="color: red; font-size: 14px"）
 */
export function parseDeclarationList(styleText: string): CssDeclaration[] {
  const trimmed = styleText.trim();
  if (!trimmed) return [];

  let ast: cssTree.CssNode;
  try {
    ast = cssTree.parse(trimmed, { context: 'declarationList' });
  } catch {
    return fallbackParseDeclarations(trimmed);
  }

  const declarations: CssDeclaration[] = [];
  cssTree.walk(ast, {
    visit: 'Declaration',
    enter(node) {
      const decl = node as cssTree.Declaration;
      let value: string;
      try {
        value = cssTree.generate(decl.value);
      } catch {
        value = String(decl.value);
      }
      declarations.push({
        property: decl.property,
        value,
        important: decl.important || false,
      });
    },
  });

  return declarations;
}

/**
 * 当 css-tree 解析失败时的回退解析
 * 简单按分号拆分，按冒号拆分属性/值
 */
function fallbackParseDeclarations(text: string): CssDeclaration[] {
  const result: CssDeclaration[] = [];
  const parts = text.split(';').filter(Boolean);
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex < 0) continue;
    const prop = part.slice(0, colonIndex).trim().toLowerCase();
    let value = part.slice(colonIndex + 1).trim();
    let important = false;
    if (/\s*!important\s*$/i.test(value)) {
      important = true;
      value = value.replace(/\s*!important\s*$/i, '').trim();
    }
    if (prop && value) {
      result.push({ property: prop, value, important });
    }
  }
  return result;
}
