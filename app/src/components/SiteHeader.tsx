import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

const LINKS: [string, string][] = [
  ['/', 'Home'],
  ['/journey', 'The Journey'],
  ['/ride', 'The Ride'],
  ['/destinations', 'Destinations'],
  ['/stories', 'Stories'],
  ['/plan', 'Plan Your Trip'],
];

// The position-aware journey engine, offline pack and evidence console are
// served by the vanilla shell under /app, outside this React router, so these
// are plain anchors rather than <Link>.
const ENGINE = '/app';

export function SiteHeader({ tone = 'light' }: { tone?: 'light' | 'onImage' }) {
  const [open, setOpen] = useState(false);
  const onImage = tone === 'onImage';
  return (
    <header className={'site-header ' + (onImage ? 'on-image' : 'light')}>
      <div className="nav-shell">
        <Link to="/" className="brand">
          <span className="brand-mark">ST</span>
          <span>Shosholoza Trail</span>
        </Link>
        <nav className="desktop-nav">
          {LINKS.map(([to, l]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l}
            </NavLink>
          ))}
          <a href={ENGINE}>Live Journey</a>
          <Link className="start-pill" to="/ride">
            Start Ride
          </Link>
        </nav>
        <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="mobile-menu">
          {LINKS.map(([to, l]) => (
            <Link onClick={() => setOpen(false)} key={to} to={to}>
              {l}
            </Link>
          ))}
          <a href={ENGINE}>Live Journey</a>
        </nav>
      )}
    </header>
  );
}
