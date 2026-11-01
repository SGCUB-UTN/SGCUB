import { formatCount } from '../cuota/cuotaPeriod'

export const countLabel = (count, singular, plural) => `${formatCount(count)} ${count === 1 ? singular : plural}`

export const shareOf = (amount, total) => (total > 0 ? (amount / total) * 100 : 0)

export const barWidth = (amount, total) => `${Math.min(shareOf(amount, total), 100)}%`
