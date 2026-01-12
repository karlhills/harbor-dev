import harborLogo from '../assets/harbor_logo.png';

const navItems = [
  { id: 'requests', label: 'Requests' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'settings', label: 'Settings' },
  { id: 'about', label: 'About' },
];

type SidebarProps = {
  active: string;
  onNavigate: (view: string) => void;
};

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-64 flex-col gap-8 border-r border-canvas-800/80 bg-canvas-900/50 px-6 py-8">
      <div>
        <div className="flex items-center gap-1">
          <img src={harborLogo} alt="Harbor logo" className="h-8 w-8" />
          <div className="text-2xl font-semibold tracking-tight text-white">Harbor</div>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          A local harbor for webhooks and HTTP traffic.
        </p>
      </div>
      <nav className="flex flex-col gap-1 text-sm font-medium text-slate-200">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`rounded-lg px-3 py-2 text-left transition ${
              active === item.id
                ? 'bg-canvas-800/60 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto text-xs text-slate-500">
        Stored locally in <span className="text-slate-300">apps/server/data</span>
      </div>
    </aside>
  );
}
