import { Fragment } from 'react'
import { BULLET, ORDERED, parseInline, parseMarkdown } from '../../utils/markdown'

function Segments({ segments }) {
  return segments.map((segment, index) => {
    let node = segment.text
    if (segment.italic) node = <em>{node}</em>
    if (segment.bold) node = <strong className="font-bold">{node}</strong>
    return <Fragment key={index}>{node}</Fragment>
  })
}

export function MarkdownInline({ text }) {
  return <Segments segments={parseInline(text ?? '')} />
}

const LIST_CLASSES = {
  [ORDERED]: 'list-decimal pl-6',
  [BULLET]: 'list-disc pl-6',
}

export default function MarkdownText({ text, className = '' }) {
  return (
    <div className={className}>
      {parseMarkdown(text).map((block, index) => {
        if (block.type === ORDERED || block.type === BULLET) {
          const List = block.type === ORDERED ? 'ol' : 'ul'
          return (
            <List key={index} start={block.type === ORDERED ? block.start : undefined} className={LIST_CLASSES[block.type]}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}><Segments segments={item} /></li>)}
            </List>
          )
        }
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <Segments segments={line} />
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
