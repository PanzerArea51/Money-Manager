import './TabBar.css';

export type TabItem = { id: string; label: string };

type TabBarProps = {
  tabs: readonly TabItem[];
  activeId: string;
  onSelect: (id: string) => void;
};

export function TabBar({ tabs, activeId, onSelect }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            className={active ? 'tab-bar__tab tab-bar__tab--active' : 'tab-bar__tab'}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
