import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Anchor } from 'lucide-react';
import type { ReactNode } from 'react';

interface NavbarProps {
  lastUpdated?: Date | null;
}

function ApiStatusIndicator({ lastUpdated }: { lastUpdated?: Date | null }) {
  const [status, setStatus] = useState<'fresh' | 'stale' | 'offline'>('fresh');

  useEffect(() => {
    if (!lastUpdated) {
      setStatus('offline');
      return;
    }
    const age = Date.now() - lastUpdated.getTime();
    if (age > 60 * 60 * 1000) {
      setStatus('offline');
    } else if (age > 30 * 60 * 1000) {
      setStatus('stale');
    } else {
      setStatus('fresh');
    }
  }, [lastUpdated]);

  const colorClass =
    status === 'fresh'
      ? 'bg-status-open'
      : status === 'stale'
        ? 'bg-status-warning'
        : 'bg-status-closed';

  return (
    <div className="flex items-center gap-2">
      <span className={`relative flex h-2 w-2`}>
        <span
          className={`animate-pulse-dot absolute inline-flex h-full w-full rounded-full ${colorClass} opacity-75`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${colorClass}`}
        />
      </span>
      <span className="font-mono-label text-text-muted">
        {lastUpdated
          ? `Mis à jour ${lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
          : 'Hors ligne'}
      </span>
    </div>
  );
}

export default function Navbar({ lastUpdated }: NavbarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    isActive
      ? 'px-4 py-1.5 rounded-full text-sm font-outfit font-semibold text-accent-teal bg-accent-teal/15 border border-accent-teal/25 transition-all duration-200'
      : 'px-4 py-1.5 rounded-full text-sm font-outfit font-semibold text-text-secondary hover:text-text-primary transition-all duration-200';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-16 bg-bg-primary/80 backdrop-blur-xl border-b border-[rgba(78,205,196,0.08)] transition-transform duration-500 ${mounted ? 'translate-y-0' : '-translate-y-16'}`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div className="mx-auto max-w-7xl h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Gauche : Logo */}
        <div className="flex items-center gap-2.5">
          <Anchor className="w-5 h-5 text-accent-teal" />
          <span className="font-outfit font-semibold text-[1.125rem] text-text-primary hidden sm:inline">
            Marées Perros-Guirec
          </span>
        </div>

        {/* Centre : Navigation */}
        <div className="flex items-center gap-1">
          <NavLink to="/" className={navLinkClass} end>
            {(): ReactNode => (
              <span>Aujourd&apos;hui</span>
            )}
          </NavLink>
          <NavLink to="/previsions" className={navLinkClass}>
            {(): ReactNode => (
              <span>Prévisions</span>
            )}
          </NavLink>
        </div>

        {/* Droite : Statut API */}
        <div className="flex items-center">
          <ApiStatusIndicator lastUpdated={lastUpdated} />
        </div>
      </div>
    </nav>
  );
}
