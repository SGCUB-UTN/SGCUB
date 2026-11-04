export const PARAGRAPH = 'paragraph'
export const ORDERED = 'ordered'
export const BULLET = 'bullet'

const ORDERED_ITEM = /^\s*(\d+)[.)]\s+(.*)$/
const BULLET_ITEM = /^\s*[-*]\s+(.*)$/
const EMPHASIS = /\*\*\*(\S(?:.*?\S)?)\*\*\*|\*\*(\S(?:.*?\S)?)\*\*|\*(\S(?:.*?\S)?)\*/g
const ITALIC = /\*(\S(?:.*?\S)?)\*/g

const splitMatches = (text, pattern, toSegments, plain = {}) => {
  const segments = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) segments.push({ ...plain, text: text.slice(last, match.index) })
    segments.push(...toSegments(match))
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ ...plain, text: text.slice(last) })
  return segments
}

const emphasisSegments = ([, boldItalic, bold, italic]) => {
  if (boldItalic !== undefined) return [{ text: boldItalic, bold: true, italic: true }]
  if (bold !== undefined) return splitMatches(bold, ITALIC, (match) => [{ text: match[1], bold: true, italic: true }], { bold: true })
  return [{ text: italic, italic: true }]
}

export const parseInline = (text) => splitMatches(text.trim(), EMPHASIS, emphasisSegments)

export const parseMarkdown = (text) => {
  const blocks = []
  let paragraph = []

  const closeParagraph = () => {
    if (paragraph.length) blocks.push({ type: PARAGRAPH, lines: paragraph.map(parseInline) })
    paragraph = []
  }

  const addItem = (type, item, start = 1) => {
    closeParagraph()
    const previous = blocks.at(-1)
    if (previous?.type === type) previous.items.push(parseInline(item))
    else blocks.push({ type, items: [parseInline(item)], start })
  }

  for (const line of (text ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const ordered = ORDERED_ITEM.exec(line)
    const bullet = !ordered && BULLET_ITEM.exec(line)
    if (ordered) addItem(ORDERED, ordered[2], Number(ordered[1]))
    else if (bullet) addItem(BULLET, bullet[1])
    else if (line.trim()) paragraph.push(line)
    else closeParagraph()
  }
  closeParagraph()
  return blocks
}

const LIST_PREFIXES = {
  [ORDERED]: { pattern: ORDERED_ITEM, prefix: (index) => `${index + 1}. ` },
  [BULLET]: { pattern: BULLET_ITEM, prefix: () => '- ' },
}

const stripListPrefix = (line) => {
  const ordered = ORDERED_ITEM.exec(line)
  if (ordered) return ordered[2]
  const bullet = BULLET_ITEM.exec(line)
  return bullet ? bullet[1] : line
}

const surroundingStars = (before, after) => Math.min(/\**$/.exec(before)[0].length, /^\**/.exec(after)[0].length)

export const wrapSelection = (value, start, end, marker, placeholder) => {
  const selected = value.slice(start, end)
  const before = value.slice(0, start)
  const after = value.slice(end)
  const stars = surroundingStars(before, after)
  if (stars === marker.length || stars === 3) {
    return {
      value: before.slice(0, -marker.length) + selected + after.slice(marker.length),
      start: start - marker.length,
      end: end - marker.length,
    }
  }
  const text = selected || placeholder
  return {
    value: `${before}${marker}${text}${marker}${after}`,
    start: start + marker.length,
    end: start + marker.length + text.length,
  }
}

export const toggleList = (value, start, end, type) => {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', end > start && value[end - 1] === '\n' ? end - 1 : end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lines = value.slice(lineStart, lineEnd).split('\n')
  const { pattern, prefix } = LIST_PREFIXES[type]
  const alreadyList = lines.every((line) => !line.trim() || pattern.test(line))
  let index = 0
  const updated = lines.map((line) => {
    if (!line.trim()) return line
    const content = stripListPrefix(line)
    return alreadyList ? content : `${prefix(index++)}${content}`
  }).join('\n')
  return {
    value: value.slice(0, lineStart) + updated + value.slice(lineEnd),
    start: lineStart,
    end: lineStart + updated.length,
  }
}
