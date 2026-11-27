import { formatDate } from '../personas/format'

export const cancellationSentence = ({ action, date, authorizedBy }) => {
  const when = date ? ` el ${formatDate(date)}` : ''
  const who = authorizedBy ? ` por ${authorizedBy}` : ''
  return `${action}${when}${who}.`
}
