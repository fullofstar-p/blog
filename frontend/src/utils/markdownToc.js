/**
 * 阅读页目录用的 Markdown 标题解析。
 *
 * 只要标题行（跳过代码块里的 #），行内标记去掉后作为目录文字；
 * line 是标题在 Markdown 里的行号，暂未使用，保留给以后需要精确定位源码的场景。
 */
export function parseMarkdownHeadings(markdown) {
  const lines = String(markdown || '').split('\n')
  const headings = []
  let inFence = false
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) return
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) return
    headings.push({
      level: match[1].length,
      text: match[2].replace(/[*_`~[\]]/g, '').trim(),
      line: index
    })
  })
  return headings
}
