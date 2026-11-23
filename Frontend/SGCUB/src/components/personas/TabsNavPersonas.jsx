import { useRef, useState } from 'react'
import StatusBadge from '../shared/StatusBadge'

const DEFAULT_TONE = { text: 'text-primary', hover: 'hover:text-primary', indicator: 'bg-primary' }
const DEFAULT_PANEL_CLASS = 'bg-surface-container-lowest rounded-b-xl shadow-sm p-6 pt-3 [--inset:1.5rem]'

export default function PersonTabs({ tabs = [], defaultTab, value, onChange, panelClassName = DEFAULT_PANEL_CLASS }) {
  const [internalTabId, setInternalTabId] = useState(defaultTab ?? tabs[0]?.id)
  const activeTabId = value ?? internalTabId
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]

  const tabRefs = useRef({})

  const selectTab = (tabId) => {
    setInternalTabId(tabId)
    onChange?.(tabId)
  }

  const handleKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.id === activeTab?.id)
    const targets = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }
    if (!(event.key in targets)) return
    event.preventDefault()
    const nextTab = tabs[targets[event.key]]
    selectTab(nextTab.id)
    tabRefs.current[nextTab.id]?.focus()
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 bg-surface-container-lowest px-4 pt-2 rounded-t-xl shadow-sm overflow-x-auto border-b border-surface-container"
        role="tablist"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => {
          const isSelected = tab.id === activeTab?.id
          const tone = tab.tone ?? DEFAULT_TONE
          return (
            <button
              key={tab.id}
              ref={(element) => { tabRefs.current[tab.id] = element }}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              aria-controls={`panel-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-3 text-base rounded-t-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 transition-colors cursor-pointer whitespace-nowrap ${
                isSelected ? `${tone.text} font-semibold` : `text-on-surface-variant ${tone.hover}`
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
              {[tab.badge].flat().filter(Boolean).map((badge, index) => (
                <StatusBadge key={index}
                 badge={badge} />
              ))}
              <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t ${isSelected ? tone.indicator : 'bg-transparent'}`} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      {activeTab && (
        <div
          id={`panel-${activeTab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab.id}`}
          tabIndex={0}
          className={`${panelClassName} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
        >
          {activeTab.content}
        </div>
      )}
    </div>
  )
}
