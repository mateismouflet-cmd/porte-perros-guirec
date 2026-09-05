import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TideData } from '@/lib/tideEngine';

export default function PressureNotice({ data }: {
  data: Pick<TideData, 'pressureStatus' | 'pressureUpdatedAt'>;
}) {
  const messages = {
    applied: 'Correction automatique : pression prévue heure par heure.',
    partial: 'Prévision de pression incomplète : certains cycles de marée sont calculés sans correction barométrique.',
    unavailable: 'Pression météo indisponible : les horaires sont calculés sans correction barométrique.',
    disabled: 'Correction barométrique désactivée : les horaires ne tiennent pas compte de la pression.',
    simulation: 'Simulation : une pression constante est appliquée à tout l’horizon de calcul.',
    included: 'L’effet de la pression est déjà inclus dans le modèle marin de secours. Le bouton et la simulation agissent uniquement sur les données SHOM.',
  };
  const warning = data.pressureStatus === 'partial' || data.pressureStatus === 'unavailable';
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${warning
      ? 'bg-status-warning/10 border-status-warning/25 text-text-primary'
      : 'bg-bg-surface border-accent-teal/10 text-text-secondary'}`}>
      <p>{messages[data.pressureStatus]}</p>
      {data.pressureUpdatedAt && (
        <p className="mt-1 text-xs text-text-muted">
          Météo Open-Meteo récupérée le {format(data.pressureUpdatedAt, 'd MMM yyyy à HH:mm', { locale: fr })}.
          {' '}Vérification toutes les 5 min ; renouvellement du cache après 30 min.
        </p>
      )}
    </div>
  );
}
