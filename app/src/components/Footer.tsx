import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

const CLE_SESSION = 'visite-comptee';

// Compteur de connexions servi par la Pages Function /api/visites (KV).
// null = pas chargé / indisponible (dev local, binding KV absent) -> rien affiché.
// Une connexion = une session de navigateur : le premier chargement de la
// session incrémente (POST), les suivants ne font que lire (GET).
function useCompteurVisites(): number | null {
  const [visites, setVisites] = useState<number | null>(null);
  useEffect(() => {
    const dejaComptee = sessionStorage.getItem(CLE_SESSION) === '1';
    if (!dejaComptee) sessionStorage.setItem(CLE_SESSION, '1');
    fetch('/api/visites', { method: dejaComptee ? 'GET' : 'POST' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { visites?: number }) => {
        if (typeof d.visites === 'number') setVisites(d.visites);
      })
      .catch(() => {}); // silencieux : dev local ou KV absent
  }, []);
  return visites;
}

export default function Footer() {
  const visites = useCompteurVisites();

  return (
    <footer className="w-full bg-bg-primary border-t border-[rgba(78,205,196,0.06)] py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-text-muted font-mono-label">
          <span>Données fournies par Open-Meteo Marine API &amp; SHOM</span>
          <a
            href="https://maree.shom.fr/harbor/PERROS-GUIREC_TRESTRAOU/hlt/0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-accent-teal hover:text-accent-teal/80 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="text-center sm:text-right">
          <p className="text-text-muted text-xs">
            À titre indicatif — vérifier toujours auprès de la capitainerie
          </p>
          <p className="mt-1 text-[11px] text-text-muted/70">
            Application révisée le 5 septembre 2026
          </p>
        </div>
      </div>
      {visites !== null && (
        <p
          className="mt-4 text-center text-[10px] text-text-muted/50 tabular-nums select-none"
          title="Connexions"
        >
          {visites.toLocaleString('fr-FR')}
        </p>
      )}
    </footer>
  );
}
