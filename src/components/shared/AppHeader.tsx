import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { MORE_LINKS, TOP_LINKS } from '../nav/links';

export function AppHeader() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_LINKS.some((item) => location.pathname === item.to);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-castiq-blue-dark/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
        <Link to="/" className="text-sm font-bold tracking-wide text-castiq-teal">
          CastIQ
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {TOP_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  isActive ? 'bg-castiq-teal/15 text-castiq-teal' : 'text-castiq-muted hover:text-castiq-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="relative">
            <button
              type="button"
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                moreOpen || moreActive ? 'bg-castiq-teal/15 text-castiq-teal' : 'text-castiq-muted hover:text-castiq-white'
              }`}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((open) => !open)}
            >
              More
            </button>
            {moreOpen && (
              <div className="absolute left-0 z-50 mt-2 w-48 rounded-xl border border-white/10 bg-castiq-blue p-1 shadow-lg" role="menu">
                {MORE_LINKS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    className={`block rounded-lg px-3 py-2 text-sm ${
                      location.pathname === item.to ? 'text-castiq-teal' : 'text-castiq-white hover:bg-castiq-blue-dark'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="ml-auto">
          <Link
            to="/profile"
            className={`text-xs font-medium ${
              location.pathname === '/profile' ? 'text-castiq-teal' : 'text-castiq-muted hover:text-castiq-white'
            }`}
          >
            Profile
          </Link>
        </div>
      </div>
    </header>
  );
}
