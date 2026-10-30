import { useState } from 'react'
import StatusBadge from '../shared/StatusBadge'

const DEFAULT_TONE = { text: 'text-primary', hover: 'hover:text-primary', indicator: 'bg-primary' }
const DEFAULT_PANEL_CLASS = 'bg-surface-container-lowest rounded-b-xl shadow-sm p-6 pt-3 [--inset:1.5rem]'

export default function PersonTabs({ tabs = [], defaultTab, value, onChange, panelClassName = DEFAULT_PANEL_CLASS }) {
  const [internalTabId, setInternalTabId] = useState(defaultTab ?? tabs[0]?.id)
  const activeTabId = value ?? internalTabId
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]

  const selectTab = (tabId) => {
    setInternalTabId(tabId)
    onChange?.(tabId)
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 bg-surface-container-lowest px-4 pt-2 rounded-t-xl shadow-sm overflow-x-auto border-b border-surface-container"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isSelected = tab.id === activeTab?.id
          const tone = tab.tone ?? DEFAULT_TONE
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-3 text-base focus:outline-none transition-colors cursor-pointer whitespace-nowrap ${
                isSelected ? `${tone.text} font-semibold` : `text-on-surface-variant ${tone.hover}`
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
              <span>{tab.label}</span>
              {[tab.badge].flat().filter(Boolean).map((badge, index) => (
                <StatusBadge key={index}
                 badge={badge} />
              ))}
              <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t ${isSelected ? tone.indicator : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>

      {activeTab && (
        <div
          id={`panel-${activeTab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab.id}`}
          className={panelClassName}
        >
          {activeTab.content}
        </div>
      )}
    </div>
  )
}
