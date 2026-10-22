import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { IconClose } from '../ui/Icons';
import { MORE_LINKS, TOP_LINKS, type AppLink } from './links';

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
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-castiq-blue-dark lg:hidden"
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

function MoreItem({
  link,
  previous,
  onClose,
  active,
}: {
  link: AppLink;
  previous?: AppLink;
  onClose: () => void;
  active: boolean;
}) {
  const showSection = link.section && link.section !== previous?.section;
  return (
    <li>
      {showSection && (
        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-castiq-muted">{link.section}</p>
      )}
      <NavLink
        to={link.to}
        onClick={onClose}
        className={`block rounded-lg px-3 py-3 text-sm font-medium ${
          active ? 'text-castiq-white' : 'text-castiq-muted hover:bg-castiq-blue hover:text-castiq-white'
        }`}
      >
        {link.label}
      </NavLink>
    </li>
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
        {MORE_LINKS.map((link, index) => (
          <MoreItem key={link.to} link={link} previous={MORE_LINKS[index - 1]} onClose={onClose} active={location.pathname === link.to} />
        ))}
      </ul>
    </dialog>
  );
}
