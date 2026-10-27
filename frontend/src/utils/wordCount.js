/**
 * Markdown 正文字数统计。
 *
 * 直接数 form.content.length 会把 `#`、`**`、表格竖线、图片链接等标记也算进去，
 * 长文能虚高几十上百字。这里先剥掉 Markdown 语法，再按
 * 「中日韩字符 + 英文/数字单词」计字数，同时给出不含空白的字符数。
 */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const LATIN_WORD = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g
const NUMBER = /[0-9]+(?:\.[0-9]+)?/g

const stripMarkdown = (markdown) =>
  String(markdown || '')
    // 代码块围栏行（保留代码内容本身）
    .replace(/^\s*(```|~~~)[^\n]*$/gm, '')
    // 图片只保留 alt，链接只保留文字
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    // HTML 标签、脚注/引用定义
    .replace(/<[^>]*>/g, '')
    .replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, '')
    // 标题、引用、列表、任务框、分隔线、表格对齐行
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, '')
    .replace(/\[[ xX]\]\s*/g, '')
    .replace(/^\s*([-*_]\s*){3,}$/gm, '')
    .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, '')
    // 表格竖线与强调标记
    .replace(/[|*_~`]/g, '')

export function countArticle(markdown) {
  const text = stripMarkdown(markdown)
  const cjk = (text.match(CJK) || []).length
  const latin = (text.match(LATIN_WORD) || []).length
  const numbers = (text.match(NUMBER) || []).length
  return {
    // 字数：中文按字、英文/数字按词
    words: cjk + latin + numbers,
    // 字符数：不含空白
    chars: text.replace(/\s+/g, '').length
  }
}
