import { useState } from 'react'
import StatusBadge from '../shared/StatusBadge'

export default function PersonTabs({ tabs = [], defaultTab }) {
  const [activeTabId, setActiveTabId] = useState(defaultTab ?? tabs[0]?.id)
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]

  return (
    <div>
      <div
        className="flex items-center gap-1 bg-surface-container-lowest px-4 pt-2 rounded-t-xl shadow-sm overflow-x-auto border-b border-surface-container"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isSelected = tab.id === activeTab?.id
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTabId(tab.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-3 text-base focus:outline-none transition-colors cursor-pointer whitespace-nowrap ${
                isSelected ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
              <span>{tab.label}</span>
              {[tab.badge].flat().filter(Boolean).map((badge, index) => (
                <StatusBadge key={index} badge={badge} />
              ))}
              <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t ${isSelected ? 'bg-primary' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>

      {activeTab && (
        <div
          id={`panel-${activeTab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab.id}`}
          className="bg-surface-container-lowest rounded-b-xl shadow-sm p-6 pt-3"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  )
}
