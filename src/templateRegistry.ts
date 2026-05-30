import brandHtml from './templates/brand.html?raw';
import courseHtml from './templates/course.html?raw';
import internationalHtml from './templates/international.html?raw';
import contentsHtml from './templates/contents.html?raw';

export const BUILTIN_TEMPLATE_MAP = {
  brand: brandHtml,
  course: courseHtml,
  international: internationalHtml,
  contents: contentsHtml
} as const;

export type BuiltinTemplateId = keyof typeof BUILTIN_TEMPLATE_MAP;
