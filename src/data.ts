import { PageDefinition, ProjectState } from './types';

const createBrandPage = (): PageDefinition => ({
  id: 'brand',
  name: '品牌与企业概况',
  template: 'brand',
  elements: [
    { id: 'brand-bg', kind: 'shape', name: '背景底板', x: 0, y: 0, w: 1600, h: 2400, bgColor: '#fbf8f2', zIndex: 0, locked: true },
    { id: 'brand-accent', kind: 'shape', name: '左侧橙条', x: 120, y: 240, w: 10, h: 110, bgColor: '#f09a4a', radius: 5, zIndex: 1 },
    { id: 'brand-kicker', kind: 'text', name: '引导语', x: 120, y: 82, w: 340, h: 40, text: 'PRODUCT HANDBOOK', color: '#95836d', fontSize: 24, letterSpacing: 4, zIndex: 2 },
    { id: 'brand-title', kind: 'text', name: '标题', x: 150, y: 220, w: 760, h: 150, text: '深圳科技与文化体验营', color: '#17202b', fontSize: 90, fontWeight: 900, lineHeight: 1.05, zIndex: 2 },
    { id: 'brand-subtitle', kind: 'text', name: '副标题', x: 150, y: 335, w: 620, h: 50, text: 'Shenzhen Tech & Culture Camp', color: '#5d6773', fontSize: 34, fontWeight: 700, zIndex: 2 },
    { id: 'brand-desc', kind: 'text', name: '正文', x: 150, y: 1110, w: 700, h: 120, text: '打造国际一流的青少年成长平台与研学智库。', color: '#17202b', fontSize: 28, fontWeight: 700, lineHeight: 1.6, zIndex: 2 },
    { id: 'brand-contact', kind: 'shape', name: '联系底板', x: 150, y: 1290, w: 1180, h: 76, bgColor: '#263445', radius: 18, zIndex: 1 },
    { id: 'brand-contact-text', kind: 'text', name: '联系信息', x: 175, y: 1308, w: 1140, h: 40, text: '深圳市龙岗区布吉街道百外教育大厦六楼', color: '#ffffff', fontSize: 24, fontWeight: 700, zIndex: 2 },
    { id: 'brand-hero', kind: 'image', name: '主图', x: 900, y: 220, w: 580, h: 780, assetId: 'asset-1', radius: 32, zIndex: 3 },
    { id: 'brand-vertical', kind: 'text', name: '背景字', x: 1240, y: 140, w: 180, h: 1600, text: '走进中国', color: '#e8c79f', fontSize: 122, fontWeight: 900, lineHeight: 1.35, opacity: 0.65, zIndex: 1 }
  ]
});

const createCoursePage = (): PageDefinition => ({
  id: 'course',
  name: '课程体系总览',
  template: 'course',
  elements: [
    { id: 'course-bg', kind: 'shape', name: '背景底板', x: 0, y: 0, w: 1600, h: 2400, bgColor: '#fbf8f2', zIndex: 0, locked: true },
    { id: 'course-title', kind: 'text', name: '标题', x: 150, y: 220, w: 700, h: 140, text: '课程体系总览', color: '#17202b', fontSize: 88, fontWeight: 900, zIndex: 2 },
    { id: 'course-subtitle', kind: 'text', name: '副标题', x: 150, y: 335, w: 640, h: 48, text: '七大课程类别', color: '#5d6773', fontSize: 34, fontWeight: 700, zIndex: 2 },
    { id: 'course-kicker', kind: 'text', name: '引导语', x: 120, y: 82, w: 340, h: 40, text: 'COURSE SYSTEM', color: '#95836d', fontSize: 24, letterSpacing: 4, zIndex: 2 },
    { id: 'course-grid-1', kind: 'shape', name: '课程卡1', x: 120, y: 540, w: 285, h: 145, bgColor: 'rgba(17,33,49,0.04)', radius: 22, zIndex: 1 },
    { id: 'course-grid-2', kind: 'shape', name: '课程卡2', x: 420, y: 540, w: 285, h: 145, bgColor: 'rgba(17,33,49,0.04)', radius: 22, zIndex: 1 },
    { id: 'course-grid-3', kind: 'shape', name: '课程卡3', x: 120, y: 705, w: 285, h: 145, bgColor: 'rgba(17,33,49,0.04)', radius: 22, zIndex: 1 },
    { id: 'course-grid-4', kind: 'shape', name: '课程卡4', x: 420, y: 705, w: 285, h: 145, bgColor: 'rgba(17,33,49,0.04)', radius: 22, zIndex: 1 },
    { id: 'course-grid-5', kind: 'shape', name: '课程卡5', x: 120, y: 870, w: 285, h: 145, bgColor: 'rgba(17,33,49,0.04)', radius: 22, zIndex: 1 },
    { id: 'course-grid-6', kind: 'shape', name: '课程卡6', x: 420, y: 870, w: 285, h: 145, bgColor: 'rgba(17,33,49,0.04)', radius: 22, zIndex: 1 },
    { id: 'course-grid-7', kind: 'shape', name: '课程卡7', x: 120, y: 1035, w: 585, h: 145, bgColor: 'rgba(17,33,49,0.04)', radius: 22, zIndex: 1 },
    { id: 'course-desc', kind: 'text', name: '正文', x: 150, y: 1250, w: 700, h: 120, text: '从国际文化到综合实践，覆盖多元研学主题。', color: '#17202b', fontSize: 28, fontWeight: 700, lineHeight: 1.6, zIndex: 2 },
    { id: 'course-contact', kind: 'shape', name: '联系底板', x: 150, y: 1410, w: 1180, h: 76, bgColor: '#263445', radius: 18, zIndex: 1 },
    { id: 'course-contact-text', kind: 'text', name: '联系信息', x: 175, y: 1428, w: 1140, h: 40, text: '适合放在品牌页之后', color: '#ffffff', fontSize: 24, fontWeight: 700, zIndex: 2 },
    { id: 'course-hero', kind: 'image', name: '主图', x: 900, y: 230, w: 620, h: 760, assetId: 'asset-2', radius: 32, zIndex: 3 }
  ]
});

const createInternationalPage = (): PageDefinition => ({
  id: 'international',
  name: '国际研学项目',
  template: 'international',
  elements: [
    { id: 'intl-bg', kind: 'shape', name: '背景底板', x: 0, y: 0, w: 1600, h: 2400, bgColor: '#fbf8f2', zIndex: 0, locked: true },
    { id: 'intl-title', kind: 'text', name: '标题', x: 150, y: 220, w: 700, h: 140, text: '国际研学项目', color: '#17202b', fontSize: 88, fontWeight: 900, zIndex: 2 },
    { id: 'intl-subtitle', kind: 'text', name: '副标题', x: 150, y: 335, w: 700, h: 48, text: 'International Research Program', color: '#5d6773', fontSize: 34, fontWeight: 700, zIndex: 2 },
    { id: 'intl-kicker', kind: 'text', name: '引导语', x: 120, y: 82, w: 340, h: 40, text: 'GLOBAL VIEW', color: '#95836d', fontSize: 24, letterSpacing: 4, zIndex: 2 },
    { id: 'intl-a', kind: 'shape', name: '项目卡1', x: 120, y: 540, w: 640, h: 176, bgColor: 'rgba(17,33,49,0.04)', radius: 22, zIndex: 1 },
    { id: 'intl-b', kind: 'shape', name: '项目卡2', x: 120, y: 740, w: 640, h: 176, bgColor: 'rgba(17,33,49,0.04)', radius: 22, zIndex: 1 },
    { id: 'intl-c', kind: 'shape', name: '项目卡3', x: 120, y: 940, w: 640, h: 176, bgColor: 'rgba(17,33,49,0.04)', radius: 22, zIndex: 1 },
    { id: 'intl-desc', kind: 'text', name: '正文', x: 150, y: 1120, w: 700, h: 120, text: '澳洲与英国国际线路，突出跨文化体验与英语沉浸。', color: '#17202b', fontSize: 28, fontWeight: 700, lineHeight: 1.6, zIndex: 2 },
    { id: 'intl-contact', kind: 'shape', name: '联系底板', x: 150, y: 1290, w: 1180, h: 76, bgColor: '#263445', radius: 18, zIndex: 1 },
    { id: 'intl-contact-text', kind: 'text', name: '联系信息', x: 175, y: 1308, w: 1140, h: 40, text: '海外研学、国际交流', color: '#ffffff', fontSize: 24, fontWeight: 700, zIndex: 2 },
    { id: 'intl-hero', kind: 'image', name: '主图', x: 860, y: 230, w: 650, h: 770, assetId: 'asset-1', radius: 32, zIndex: 3 }
  ]
});

const createContentsPage = (): PageDefinition => ({
  id: 'contents',
  name: '页面目录索引',
  template: 'contents',
  elements: [
    { id: 'cont-bg', kind: 'shape', name: '背景底板', x: 0, y: 0, w: 1600, h: 2400, bgColor: '#fbf8f2', zIndex: 0, locked: true },
    { id: 'cont-title', kind: 'text', name: '标题', x: 150, y: 220, w: 700, h: 140, text: '页面目录索引', color: '#17202b', fontSize: 88, fontWeight: 900, zIndex: 2 },
    { id: 'cont-subtitle', kind: 'text', name: '副标题', x: 150, y: 335, w: 700, h: 48, text: 'Contents / Navigation', color: '#5d6773', fontSize: 34, fontWeight: 700, zIndex: 2 },
    { id: 'cont-kicker', kind: 'text', name: '引导语', x: 120, y: 82, w: 340, h: 40, text: 'CONTENTS', color: '#95836d', fontSize: 24, letterSpacing: 4, zIndex: 2 },
    { id: 'cont-list-1', kind: 'shape', name: '目录卡片', x: 120, y: 540, w: 640, h: 92, bgColor: 'rgba(17,33,49,0.04)', radius: 20, zIndex: 1 },
    { id: 'cont-list-2', kind: 'shape', name: '目录卡片', x: 120, y: 648, w: 640, h: 92, bgColor: 'rgba(17,33,49,0.04)', radius: 20, zIndex: 1 },
    { id: 'cont-list-3', kind: 'shape', name: '目录卡片', x: 120, y: 756, w: 640, h: 92, bgColor: 'rgba(17,33,49,0.04)', radius: 20, zIndex: 1 },
    { id: 'cont-list-4', kind: 'shape', name: '目录卡片', x: 120, y: 864, w: 640, h: 92, bgColor: 'rgba(17,33,49,0.04)', radius: 20, zIndex: 1 },
    { id: 'cont-list-5', kind: 'shape', name: '目录卡片', x: 120, y: 972, w: 640, h: 92, bgColor: 'rgba(17,33,49,0.04)', radius: 20, zIndex: 1 },
    { id: 'cont-desc', kind: 'text', name: '正文', x: 150, y: 1080, w: 700, h: 120, text: '用于快速浏览全书结构和页面顺序。', color: '#17202b', fontSize: 28, fontWeight: 700, lineHeight: 1.6, zIndex: 2 },
    { id: 'cont-contact', kind: 'shape', name: '联系底板', x: 150, y: 1210, w: 1180, h: 76, bgColor: '#263445', radius: 18, zIndex: 1 },
    { id: 'cont-contact-text', kind: 'text', name: '联系信息', x: 175, y: 1228, w: 1140, h: 40, text: '建议放在目录后', color: '#ffffff', fontSize: 24, fontWeight: 700, zIndex: 2 },
    { id: 'cont-hero', kind: 'image', name: '主图', x: 900, y: 280, w: 560, h: 700, assetId: 'asset-2', radius: 32, zIndex: 3 }
  ]
});

export const defaultProject: ProjectState = {
  projectName: '起航研学产品手册',
  assets: [
    { id: 'asset-1', name: '寻根之旅客家与闽南.jpg', url: '/assets/寻根之旅客家与闽南.jpg' },
    { id: 'asset-2', name: '微信图片_20260526230233_606_2.jpg', url: '/assets/微信图片_20260526230233_606_2.jpg' }
  ],
  activePageId: 'brand',
  pages: [createBrandPage(), createCoursePage(), createInternationalPage(), createContentsPage()]
};
