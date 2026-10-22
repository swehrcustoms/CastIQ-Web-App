import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { IconClose } from '../ui/Icons';
import { MORE_LINKS, TOP_LINKS } from './links';

export function AppNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const moreActive = MORE_LINKS.some((item) => location.pathname === item.to);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-castiq-blue-dark md:hidden"
        aria-label="Primary"
      >
        <div className="flex">
          {TOP_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-14 flex-1 items-center justify-center px-1 text-center text-[11px] font-medium ${
                  isActive ? 'text-castiq-teal' : 'text-castiq-muted'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            className={`flex min-h-14 flex-1 items-center justify-center px-1 text-center text-[11px] font-medium ${
              open || moreActive ? 'text-castiq-teal' : 'text-castiq-muted'
            }`}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            More
          </button>
        </div>
      </nav>
      {open && <MoreDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function MoreDialog({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl border border-white/10 bg-castiq-blue-dark p-0 text-castiq-white backdrop:bg-black/60 sm:m-auto sm:max-w-md sm:rounded-2xl"
      aria-label="More"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold">More</h2>
        <button type="button" onClick={onClose} aria-label="Close menu" className="text-castiq-muted">
          <IconClose />
        </button>
      </div>
      <ul className="p-2">
        {MORE_LINKS.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              onClick={onClose}
              className={`block rounded-lg px-3 py-3 text-sm font-medium ${
                location.pathname === link.to ? 'text-castiq-teal' : 'text-castiq-white hover:bg-castiq-blue'
              }`}
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
