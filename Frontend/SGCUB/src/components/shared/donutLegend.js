const LEGEND_ITEM_CLASS = 'rounded-md -mx-1.5 px-1.5 py-0.5 cursor-default transition-[opacity,background-color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'

export const legendItemProps = (key, activeKey, onActiveChange) => {
  const state = activeKey === key ? 'bg-surface-container-low' : activeKey !== null ? 'opacity-40' : ''
  return {
    tabIndex: 0,
    className: `${LEGEND_ITEM_CLASS} ${state}`,
    onMouseEnter: () => onActiveChange(key),
    onMouseLeave: () => onActiveChange(null),
    onFocus: () => onActiveChange(key),
    onBlur: () => onActiveChange(null),
  }
}
