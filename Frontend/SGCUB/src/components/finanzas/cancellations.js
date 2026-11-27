import { formatDate } from '../personas/format'

export const cancellationSentence = ({ action, date, authorizedBy }) => {
  const when = date ? ` el ${formatDate(date)}` : ''
  const who = authorizedBy ? ` por ${authorizedBy}` : ''
  return `${action}${when}${who}.`
}

export const cancellationSummary = ({ reason, ...sentence }) => {
  const text = cancellationSentence(sentence)
  return reason ? `${text} Motivo: "${reason}"` : text
}
