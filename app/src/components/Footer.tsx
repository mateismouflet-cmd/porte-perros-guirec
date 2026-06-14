import { ExternalLink } from 'lucide-react';

export default function Footer() {
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
        <p className="text-text-muted text-xs">
          À titre indicatif — vérifier toujours auprès de la capitainerie
        </p>
      </div>
    </footer>
  );
}
