export default function TabBar({ activeTab, onTabChange }) {
  const tabs = ['today', 'history', 'me']
  const labels = {
    today: 'Today',
    history: 'History',
    me: 'Me'
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-divider bg-white z-40">
      <style>{`
        nav {
          padding-bottom: max(0, env(safe-area-inset-bottom));
        }
      `}</style>
      <div className="flex items-center justify-around h-14">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 h-14 flex items-center justify-center text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-black'
                : 'text-secondary'
            }`}
          >
            {labels[tab]}
          </button>
        ))}
      </div>
    </nav>
  )
}
