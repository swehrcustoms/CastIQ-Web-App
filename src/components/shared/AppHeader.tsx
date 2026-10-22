import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { MORE_LINKS, TOP_LINKS, type AppLink } from '../nav/links';

function linkClass(active: boolean): string {
  return `text-sm ${active ? 'text-castiq-white' : 'text-castiq-muted hover:text-castiq-white'}`;
}

function sections(links: AppLink[]): { title: string; links: AppLink[] }[] {
  const groups: { title: string; links: AppLink[] }[] = [];
  for (const link of links) {
    const title = link.section ?? '';
    const current = groups[groups.length - 1];
    if (current && current.title === title) current.links.push(link);
    else groups.push({ title, links: [link] });
  }
  return groups;
}

export function AppHeader() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreActive = MORE_LINKS.some((item) => location.pathname === item.to);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onPointer(event: MouseEvent) {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-castiq-blue-dark/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="text-lg font-black tracking-[0.18em] text-castiq-white">
          CASTIQ
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {TOP_LINKS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => linkClass(isActive)}>
              {item.label}
            </NavLink>
          ))}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              className={linkClass(moreOpen || moreActive)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((open) => !open)}
            >
              More
            </button>
            {moreOpen && (
              <div className="absolute left-0 z-50 mt-3 w-56 rounded-xl border border-white/10 bg-castiq-blue-dark p-2 shadow-lg" role="menu">
                {sections(MORE_LINKS).map((group) => (
                  <div key={group.title || 'links'} className="py-1">
                    {group.title && (
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-castiq-muted">
                        {group.title}
                      </p>
                    )}
                    {group.links.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        role="menuitem"
                        className={`block rounded-lg px-3 py-2 text-sm ${
                          location.pathname === item.to ? 'text-castiq-white' : 'text-castiq-muted hover:bg-white/5 hover:text-castiq-white'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        <Link to="/profile" className={`text-sm ${location.pathname === '/profile' ? 'text-castiq-white' : 'text-castiq-muted hover:text-castiq-white'}`}>
          Profile
        </Link>
      </div>
    </header>
  );
}
