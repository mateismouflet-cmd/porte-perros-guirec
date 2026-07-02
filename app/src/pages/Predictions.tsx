import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Anchor,
  ArrowUpDown,
  Copy,
  Check,
  Clock,
  Waves,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  format,
  addDays,
  isSameDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import Layout from '@/components/Layout';
import {
  getTideDataForDates,
  formatDuration,
} from '@/lib/tideEngine';
import type { TideData, TideEvent, TideWindow, TideSource } from '@/lib/tideEngine';

// ============================================================
// Animation helpers
// ============================================================

const easeSmooth = [0.22, 1, 0.36, 1] as [number, number, number, number];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: easeSmooth,
    },
  }),
};

const pillVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.04,
      duration: 0.35,
      ease: easeSmooth,
    },
  }),
};

// ============================================================
// Types
// ============================================================

interface DayPrediction {
  date: Date;
  dayName: string;
  dayNameShort: string;
  morningBM: TideEvent | null;
  pm: TideEvent;
  eveningBM: TideEvent | null;
  /** Tous les PM/BM du jour, dans l'ordre chronologique */
  events: TideEvent[];
  coefficient: number;
  /** Coefficients officiels de chaque marée haute du jour, ex "49 / 52" */
  coefLabel: string;
  openWindows: TideWindow[];
  totalOpenDuration: number;
  status: 'open' | 'marginal' | 'closed';
  advice: string;
  hourlyData: { time: string; height: number }[];
}

type SortColumn = 'day' | 'bm' | 'coef' | 'pm' | 'open' | 'close' | 'duration' | 'status';
type SortDirection = 'asc' | 'desc';

// ============================================================
// Construction des prévisions à partir des données réelles du moteur
// ============================================================

function toDayPrediction(td: TideData, date: Date): DayPrediction {
  const pms = td.events.filter((e) => e.type === 'PM');
  const bms = td.events.filter((e) => e.type === 'BM');

  // PM de référence affichée dans le tableau : la plus haute du jour
  const pm: TideEvent =
    pms.length > 0
      ? pms.reduce((a, b) => (b.height > a.height ? b : a))
      : {
          time: new Date(date.getTime() + 12 * 3600 * 1000),
          type: 'PM',
          height: td.currentHeight,
        };
  const morningBM = bms[0] ?? null;
  const eveningBM = bms.length > 1 ? bms[bms.length - 1] : null;

  const windows = td.windows;
  const totalOpenDuration = windows.reduce((sum, w) => sum + w.durationMinutes, 0);

  let status: 'open' | 'marginal' | 'closed';
  if (totalOpenDuration > 60) {
    status = 'open';
  } else if (totalOpenDuration > 0) {
    status = 'marginal';
  } else {
    status = 'closed';
  }

  let advice: string;
  const totalHours = totalOpenDuration / 60;
  const opensMorning = windows.some((w) => w.openTime.getHours() < 12);
  const closesEvening = windows.some((w) => w.closeTime.getHours() >= 17);
  const hasLongWindow = windows.some((w) => w.durationMinutes >= 120);
  if (totalHours <= 0) {
    advice = `Porte fermée toute la journée — pas de sortie possible.`;
  } else if (totalHours <= 1) {
    advice = `⚠️ Ouverture très courte — la porte ne s'ouvrira peut-être pas. Vérifier avec la capitainerie.`;
  } else if (opensMorning && closesEvening) {
    advice = `Belle journée — ouverture le matin et fermeture le soir.`;
  } else if (hasLongWindow) {
    advice = `Belle plage d'au moins 2h d'ouverture — idéal pour une balade dans la baie.`;
  } else {
    advice = `Fenêtre de navigation courte — prévoir son créneau.`;
  }

  // Courbe pour le graphique : un point tous les quarts d'heure
  const hourlyData = td.curve
    .filter((_, i) => i % 3 === 0)
    .map((p) => ({
      time: format(p.time, 'HH:mm', { locale: fr }),
      height: Math.round(p.height * 100) / 100,
    }));

  const officialCoefs = td.events
    .filter((e) => e.type === 'PM' && e.coefficient !== undefined)
    .map((e) => e.coefficient);

  return {
    date,
    dayName: format(date, 'EEEE', { locale: fr }),
    dayNameShort: format(date, 'EEE', { locale: fr }).replace('.', ''),
    morningBM,
    pm,
    eveningBM,
    events: td.events,
    coefficient: td.coefficient,
    coefLabel: officialCoefs.length > 0 ? officialCoefs.join(' / ') : String(td.coefficient),
    openWindows: windows,
    totalOpenDuration,
    status,
    advice,
    hourlyData,
  };
}

async function load7DaysData(): Promise<{ days: DayPrediction[]; source: TideSource }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tideData = await getTideDataForDates(today, 7, 0);
  return {
    days: tideData.map((td, i) => toDayPrediction(td, addDays(today, i))),
    source: tideData[0]?.source ?? 'mock',
  };
}

// ============================================================
// Helpers de formatage
// ============================================================

function fmtTime(date: Date): string {
  return format(date, 'HH:mm', { locale: fr });
}

function fmtDate(date: Date): string {
  return format(date, 'EEEE d MMMM', { locale: fr });
}

function fmtShortDate(date: Date): string {
  return format(date, 'd MMM', { locale: fr });
}

// ============================================================
// Section 1: Sélecteur de Date
// ============================================================

interface DateSelectorProps {
  days: DayPrediction[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function DateSelector({ days, selectedIndex, onSelect }: DateSelectorProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="sticky top-16 z-40 h-[72px] bg-bg-primary/80 backdrop-blur-xl border-b border-[rgba(78,205,196,0.06)] flex items-center px-4 sm:px-6 overflow-x-auto">
      <div className="mx-auto max-w-7xl w-full flex items-center justify-center gap-3">
        {days.map((day, i) => {
          const isToday = isSameDay(day.date, today);
          const isActive = i === selectedIndex;

          return (
            <motion.button
              key={i}
              custom={i}
              variants={pillVariants}
              initial="hidden"
              animate="visible"
              onClick={() => onSelect(i)}
              className={`
                relative flex flex-col items-center min-w-[56px] py-2 px-3 rounded-xl
                transition-all duration-200 cursor-pointer border
                ${isActive
                  ? 'bg-accent-teal/12 border-[rgba(78,205,196,0.3)] text-text-primary'
                  : 'bg-bg-secondary border-transparent text-text-muted hover:bg-bg-tertiary hover:text-text-secondary'
                }
              `}
            >
              {isToday && (
                <span className="absolute -top-1.5 -right-1 text-[10px] font-medium bg-accent-teal text-bg-primary px-1.5 py-0.5 rounded-full">
                  Auj
                </span>
              )}
              <span className="text-[0.6875rem] capitalize leading-tight">
                {day.dayNameShort}
              </span>
              <span className={`font-mono text-[1rem] font-medium leading-tight ${isActive ? 'text-accent-teal' : 'text-text-primary'}`}>
                {format(day.date, 'd', { locale: fr })}
              </span>
              <span className="text-[0.6875rem] leading-tight opacity-70">
                {format(day.date, 'MMM', { locale: fr })}
              </span>
              {/* Indicateur de porte */}
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full ${
                  day.status === 'open'
                    ? 'bg-status-open'
                    : day.status === 'marginal'
                      ? 'bg-status-warning'
                      : 'bg-status-closed'
                }`}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Section 2: Résumé Hebdomadaire
// ============================================================

function WeeklySummary({ days, onSelectDay }: { days: DayPrediction[]; onSelectDay: (index: number) => void }) {
  return (
    <motion.div
      custom={0}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-[rgba(78,205,196,0.06)] gradient-surface p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
    >
      <div className="mb-5">
        <h2 className="font-outfit font-semibold text-[1.75rem] text-text-primary tracking-[-0.02em]">
          Résumé de la semaine
        </h2>
        <p className="text-[0.9375rem] text-text-secondary mt-1">
          Vue d&apos;ensemble des ouvertures de porte
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        {days.map((day, i) => (
          <motion.div
            key={i}
            custom={i}
            variants={{
              hidden: { opacity: 0, y: 15, scale: 0.96 },
              visible: (idx: number) => ({
                opacity: 1,
                y: 0,
                scale: 1,
                transition: {
                  delay: idx * 0.05,
                  duration: 0.4,
                  ease: easeSmooth,
                },
              }),
            }}
            initial="hidden"
            animate="visible"
            onClick={() => onSelectDay(i)}
            className="cursor-pointer bg-bg-secondary rounded-xl border border-[rgba(78,205,196,0.06)] p-4
              hover:-translate-y-1 hover:border-[rgba(78,205,196,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]
              transition-all duration-250"
          >
            {/* En-tête */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-outfit font-semibold text-[1rem] text-text-primary capitalize">
                {day.dayNameShort} {format(day.date, 'd', { locale: fr })}
              </span>
              {day.status === 'open' ? (
                <CheckCircle className="w-4 h-4 text-status-open" />
              ) : day.status === 'marginal' ? (
                <AlertTriangle className="w-4 h-4 text-status-warning" />
              ) : (
                <XCircle className="w-4 h-4 text-status-closed" />
              )}
            </div>

            {/* Corps */}
            <div className="space-y-1 mb-3">
              <p className="text-[0.9375rem] text-text-secondary">
                {day.openWindows.length > 0
                  ? `${day.openWindows.length} ouverture${day.openWindows.length > 1 ? 's' : ''}`
                  : 'Fermé'}
              </p>
              {day.totalOpenDuration > 0 && (
                <>
                  <p className="font-mono text-[1rem] text-text-accent">
                    {formatDuration(day.totalOpenDuration)}
                  </p>
                  {day.openWindows.length > 0 && (
                    <p className="text-[0.8125rem] text-text-secondary">
                      {fmtTime(day.openWindows[0].openTime)} – {fmtTime(day.openWindows[0].closeTime)}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Coefficient badge */}
            <div className={`inline-block text-[0.8125rem] px-2 py-0.5 rounded-md ${
              day.coefficient > 70
                ? 'bg-sun-gold/10 text-sun-gold'
                : 'bg-accent-ocean/10 text-accent-ocean'
            }`}>
              Coef. {day.coefLabel}
            </div>

            {/* Mini-barre visuelle */}
            <div className="mt-3 h-1 rounded-full bg-bg-surface overflow-hidden">
              {day.totalOpenDuration > 0 && day.openWindows.length > 0 && (
                <motion.div
                  className="h-full rounded-full bg-status-open"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (day.totalOpenDuration / (24 * 60)) * 100 * 4)}%` }}
                  transition={{ delay: 0.3, duration: 0.6, ease: easeSmooth }}
                />
              )}
              {day.totalOpenDuration === 0 && (
                <div className="h-full w-full bg-status-closed/30" />
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// Section 3: Tableau des Prévisions
// ============================================================

function PredictionsTable({
  days,
  onSelectDay,
  sortColumn,
  sortDirection,
  onSort,
}: {
  days: DayPrediction[];
  onSelectDay: (index: number) => void;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (col: SortColumn) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sortedDays = useMemo(() => {
    const sorted = [...days.map((d, i) => ({ ...d, originalIndex: i }))];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'day':
          cmp = a.date.getTime() - b.date.getTime();
          break;
        case 'bm':
          cmp = (a.morningBM?.height ?? 0) - (b.morningBM?.height ?? 0);
          break;
        case 'coef':
          cmp = a.coefficient - b.coefficient;
          break;
        case 'pm':
          cmp = a.pm.height - b.pm.height;
          break;
        case 'duration':
          cmp = a.totalOpenDuration - b.totalOpenDuration;
          break;
        case 'status':
          const statusOrder = { open: 0, marginal: 1, closed: 2 };
          cmp = statusOrder[a.status] - statusOrder[b.status];
          break;
        default:
          cmp = 0;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [days, sortColumn, sortDirection]);

  const SortableHeader = ({ col, children, className = '' }: { col: SortColumn; children: React.ReactNode; className?: string }) => (
    <th
      onClick={() => onSort(col)}
      className={`cursor-pointer select-none hover:text-text-primary transition-colors ${className}`}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3 opacity-50" />
      </div>
    </th>
  );

  return (
    <motion.div
      custom={1}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-[rgba(78,205,196,0.06)] gradient-surface p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
    >
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="font-outfit font-semibold text-[1.75rem] text-text-primary tracking-[-0.02em]">
            Prévisions détaillées
          </h2>
          <p className="text-[0.8125rem] text-status-warning mt-1">
            Données calculées sans marge de sécurité — vérifier auprès de la capitainerie
          </p>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-bg-tertiary text-left">
              <SortableHeader col="day" className="font-mono-label text-text-muted px-4 py-3 rounded-tl-lg">Jour</SortableHeader>
              <th className="font-mono-label text-text-muted px-4 py-3">BM Matin</th>
              <SortableHeader col="coef" className="font-mono-label text-text-muted px-4 py-3">Coefficient</SortableHeader>
              <SortableHeader col="pm" className="font-mono-label text-text-muted px-4 py-3">PM</SortableHeader>
              <th className="font-mono-label text-text-muted px-4 py-3">BM Soir</th>
              <th className="font-mono-label text-text-muted px-4 py-3">Ouverture</th>
              <th className="font-mono-label text-text-muted px-4 py-3">Fermeture</th>
              <SortableHeader col="duration" className="font-mono-label text-text-muted px-4 py-3">Durée</SortableHeader>
              <SortableHeader col="status" className="font-mono-label text-text-muted px-4 py-3 rounded-tr-lg">Statut</SortableHeader>
            </tr>
          </thead>
          <tbody>
            {sortedDays.map((day, i) => {
              const isToday = isSameDay(day.date, today);
              return (
                <motion.tr
                  key={i}
                  onClick={() => onSelectDay(day.originalIndex)}
                  className={`
                    cursor-pointer transition-colors duration-150 border-b border-[rgba(78,205,196,0.04)]
                    ${isToday ? 'border-l-[3px] border-l-accent-teal bg-bg-tertiary/50' : ''}
                    ${i % 2 === 0 ? 'bg-bg-primary/30' : 'bg-bg-secondary/30'}
                    hover:bg-bg-tertiary/70
                  `}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.35, ease: easeSmooth }}
                >
                  <td className="px-4 py-3.5">
                    <span className="font-outfit font-semibold text-[1rem] text-text-primary capitalize block">
                      {day.dayName}
                    </span>
                    <span className="text-[0.8125rem] text-text-muted">
                      {fmtShortDate(day.date)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {day.morningBM ? (
                      <>
                        <span className="font-mono text-[0.875rem] text-text-primary">{fmtTime(day.morningBM.time)}</span>
                        <span className="font-mono text-[0.875rem] text-text-accent ml-2">{day.morningBM.height.toFixed(1)} m</span>
                      </>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`font-mono text-[0.9375rem] font-medium ${day.coefficient > 70 ? 'text-sun-gold' : 'text-accent-ocean'}`}>
                      {day.coefLabel}
                    </span>
                    <span className="text-[0.8125rem] text-text-muted block">
                      {day.coefficient > 70 ? 'Vive-eau' : 'Morte-eau'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-[0.875rem] text-text-primary">{fmtTime(day.pm.time)}</span>
                    <span className="font-mono text-[0.875rem] text-text-accent ml-2">{day.pm.height.toFixed(1)} m</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {day.eveningBM ? (
                      <>
                        <span className="font-mono text-[0.875rem] text-text-primary">{fmtTime(day.eveningBM.time)}</span>
                        <span className="font-mono text-[0.875rem] text-text-accent ml-2">{day.eveningBM.height.toFixed(1)} m</span>
                      </>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {day.openWindows.length > 0 ? (
                      day.openWindows.map((w, wi) => (
                        <span key={wi} className="font-mono text-[0.9375rem] font-semibold text-status-open block">
                          {fmtTime(w.openTime)}
                        </span>
                      ))
                    ) : (
                      <span className="text-status-closed">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {day.openWindows.length > 0 ? (
                      day.openWindows.map((w, wi) => (
                        <span key={wi} className="font-mono text-[0.9375rem] font-semibold text-status-closed block">
                          {fmtTime(w.closeTime)}
                        </span>
                      ))
                    ) : (
                      <span className="text-status-closed">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {day.openWindows.length > 0 ? (
                      day.openWindows.map((w, wi) => (
                        <span key={wi} className="font-mono text-[0.9375rem] text-text-primary block">
                          {formatDuration(w.durationMinutes)}
                        </span>
                      ))
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {day.status === 'open' ? (
                      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] bg-status-open/12 text-status-open border border-status-open/25 px-2.5 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Ouvert
                      </span>
                    ) : day.status === 'marginal' ? (
                      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] bg-status-warning/12 text-status-warning border border-status-warning/25 px-2.5 py-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        Marginal
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] bg-status-closed/12 text-status-closed border border-status-closed/25 px-2.5 py-1 rounded-full">
                        <XCircle className="w-3 h-3" />
                        Fermé
                      </span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {sortedDays.map((day, i) => {
          const isToday = isSameDay(day.date, today);
          return (
            <motion.div
              key={i}
              onClick={() => onSelectDay(day.originalIndex)}
              className={`
                cursor-pointer rounded-xl p-4 border transition-colors
                ${isToday ? 'border-accent-teal/30 bg-bg-tertiary/50' : 'border-[rgba(78,205,196,0.06)] bg-bg-secondary'}
              `}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease: easeSmooth }}
            >
              {/* En-tête */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-outfit font-semibold text-[1rem] text-text-primary capitalize">
                    {day.dayName} {fmtShortDate(day.date)}
                  </span>
                </div>
                {day.status === 'open' ? (
                  <CheckCircle className="w-5 h-5 text-status-open" />
                ) : day.status === 'marginal' ? (
                  <AlertTriangle className="w-5 h-5 text-status-warning" />
                ) : (
                  <XCircle className="w-5 h-5 text-status-closed" />
                )}
              </div>

              {/* Marées */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                <div>
                  <p className="text-text-muted text-xs">BM Matin</p>
                  <p className="font-mono text-text-primary">{day.morningBM ? fmtTime(day.morningBM.time) : '—'}</p>
                  {day.morningBM && <p className="font-mono text-text-accent text-xs">{day.morningBM.height.toFixed(1)} m</p>}
                </div>
                <div>
                  <p className="text-text-muted text-xs">PM</p>
                  <p className="font-mono text-text-primary">{fmtTime(day.pm.time)}</p>
                  <p className="font-mono text-text-accent text-xs">{day.pm.height.toFixed(1)} m</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">BM Soir</p>
                  <p className="font-mono text-text-primary">{day.eveningBM ? fmtTime(day.eveningBM.time) : '—'}</p>
                  {day.eveningBM && <p className="font-mono text-text-accent text-xs">{day.eveningBM.height.toFixed(1)} m</p>}
                </div>
              </div>

              {/* Porte */}
              {day.openWindows.length > 0 && (
                <div className="text-sm border-t border-[rgba(78,205,196,0.06)] pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-text-muted text-xs">Ouverture</p>
                    <p className="text-text-muted text-xs">Durée</p>
                  </div>
                  {day.openWindows.map((w, wi) => (
                    <div key={wi} className="flex items-center justify-between">
                      <p className="font-mono text-status-open">{fmtTime(w.openTime)} – {fmtTime(w.closeTime)}</p>
                      <p className="font-mono text-text-accent">{formatDuration(w.durationMinutes)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Coefficient */}
              <div className="mt-2">
                <span className={`inline-block text-xs px-2 py-0.5 rounded-md ${
                  day.coefficient > 70 ? 'bg-sun-gold/10 text-sun-gold' : 'bg-accent-ocean/10 text-accent-ocean'
                }`}>
                  Coefficient {day.coefLabel} — {day.coefficient > 70 ? 'Vive-eau' : 'Morte-eau'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ============================================================
// Section 4: Vue Jour Détaillée
// ============================================================

function DayDetailView({ day, dayIndex }: { day: DayPrediction; dayIndex: number }) {
  const [safetyMargin, setSafetyMargin] = useState<0 | -15 | -30>(0);
  const [copied, setCopied] = useState(false);

  const adjustedWindows = useMemo(() => {
    if (safetyMargin === 0) return day.openWindows;
    return day.openWindows.map(w => ({
      ...w,
      closeTime: new Date(w.closeTime.getTime() + safetyMargin * 60 * 1000),
      durationMinutes: w.durationMinutes + safetyMargin,
    }));
  }, [day.openWindows, safetyMargin]);

  const adjustedDuration = adjustedWindows.reduce((sum, w) => sum + Math.max(0, w.durationMinutes), 0);
  const openWindowsWithDuration = adjustedWindows.filter((w) => w.durationMinutes > 0);

  const handleCopy = useCallback(() => {
    const tideLines = day.events
      .map((e) => `${e.type === 'PM' ? 'PM' : 'BM'}: ${fmtTime(e.time)} (${e.height.toFixed(2)}m${e.coefficient !== undefined ? `, coef ${e.coefficient}` : ''})`)
      .join('\n');
    const windowLines =
      day.openWindows.length > 0
        ? day.openWindows
            .map((w) => `Porte ouverte: ${fmtTime(w.openTime)} - ${fmtTime(w.closeTime)} (${formatDuration(w.durationMinutes)})`)
            .join('\n')
        : 'Porte fermée';
    const text = `${fmtDate(day.date)}\n${tideLines}\nCoefficient: ${day.coefLabel}\n${windowLines}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Ignorer les erreurs de copie
    });
  }, [day]);

  // Points clés chronologiques : marées et mouvements de porte entremêlés
  const keyEvents = useMemo(() => {
    const entries: { at: Date; time: string; label: string; value: string; color: string }[] = [];

    for (const e of day.events) {
      if (e.type === 'PM') {
        entries.push({
          at: e.time,
          time: fmtTime(e.time),
          label: 'Pleine Mer',
          value: `${e.height.toFixed(2)} m${e.coefficient !== undefined ? ` — Coefficient ${e.coefficient}` : ''}`,
          color: 'bg-accent-teal',
        });
      } else {
        entries.push({
          at: e.time,
          time: fmtTime(e.time),
          label: 'Basse Mer',
          value: `${e.height.toFixed(2)} m`,
          color: 'bg-accent-ocean',
        });
      }
    }

    for (const w of day.openWindows) {
      entries.push({
        at: w.openTime,
        time: fmtTime(w.openTime),
        label: 'Ouverture porte',
        value: '≥ 7.33 m (marée montante)',
        color: 'bg-status-open',
      });
      const pm = day.events.find(
        (e) => e.type === 'PM' && e.time.getTime() >= w.openTime.getTime()
      );
      const closeRule = pm && pm.height > 7.6
        ? day.coefficient >= 70
          ? (pm.height > 8.0 ? 'Descente sous 8.00 m' : 'À la pleine mer (PM < 8 m)')
          : 'Descente sous 7.60 m'
        : 'À la pleine mer (PM < 7.6 m)';
      entries.push({
        at: w.closeTime,
        time: fmtTime(w.closeTime),
        label: 'Fermeture porte',
        value: closeRule,
        color: 'bg-status-closed',
      });
    }

    entries.sort((a, b) => a.at.getTime() - b.at.getTime());
    return entries;
  }, [day]);

  return (
    <motion.div
      key={dayIndex}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-[rgba(78,205,196,0.06)] gradient-surface p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
    >
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-outfit font-semibold text-[1.75rem] text-text-primary tracking-[-0.02em]">
            Détails du {fmtDate(day.date)}
          </h2>
          <span className={`inline-block mt-2 text-[0.8125rem] px-3 py-1 rounded-full ${
            day.coefficient > 70
              ? 'bg-sun-gold/10 text-sun-gold'
              : 'bg-accent-ocean/10 text-accent-ocean'
          }`}>
            Coefficient {day.coefLabel} — {day.coefficient > 70 ? 'Vive-eau' : 'Morte-eau'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[0.8125rem] text-text-secondary hover:text-accent-teal transition-colors px-3 py-1.5 rounded-lg hover:bg-accent-teal/8"
        >
          {copied ? <Check className="w-4 h-4 text-status-open" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>

      {/* Mini Graphique */}
      <div className="mb-6 h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={day.hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`tideGradient-${dayIndex}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ECDC4" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#2196F3" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(78,205,196,0.06)" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#4A5E7D', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(78,205,196,0.1)' }}
              interval={3}
            />
            <YAxis
              tick={{ fill: '#4A5E7D', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              domain={[1, 12]}
              tickFormatter={(v: number) => `${v}m`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F1D32',
                border: '1px solid rgba(78,205,196,0.15)',
                borderRadius: '8px',
                fontFamily: 'JetBrains Mono',
                fontSize: '0.75rem',
                color: '#E8EDF5',
              }}
              formatter={(value: number) => [`${value.toFixed(2)} m`, 'Hauteur']}
            />
            <ReferenceLine y={7.33} stroke="#2ECC71" strokeDasharray="5 5" strokeOpacity={0.5} />
            <Area
              type="monotone"
              dataKey="height"
              stroke="#4ECDC4"
              strokeWidth={2}
              fill={`url(#tideGradient-${dayIndex})`}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Blocs d'information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne Gauche — Horaires clés */}
        <div>
          <h3 className="font-outfit font-semibold text-[1rem] text-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-teal" />
            Horaires clés
          </h3>
          <div className="space-y-0">
            {keyEvents.map((event, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.35, ease: easeSmooth }}
                className="flex items-start gap-3 py-3 border-b border-[rgba(78,205,196,0.04)] last:border-0"
              >
                <div className="flex flex-col items-center mt-1.5">
                  <span className={`w-2 h-2 rounded-full ${event.color}`} />
                  {i < keyEvents.length - 1 && (
                    <span className="w-px h-full min-h-[20px] bg-bg-surface mt-1" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-mono text-[0.875rem] text-text-primary font-medium">{event.time}</p>
                  <p className="text-[0.8125rem] text-text-secondary">{event.label}</p>
                  <p className="text-[0.8125rem] text-text-accent">{event.value}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Colonne Droite — Conseil navigation */}
        <div>
          <h3 className="font-outfit font-semibold text-[1rem] text-text-primary mb-4 flex items-center gap-2">
            <Waves className="w-4 h-4 text-accent-teal" />
            Synthèse du jour
          </h3>
          <div className="relative bg-bg-tertiary rounded-xl p-5">
            <Anchor className="absolute top-4 right-4 w-6 h-6 text-accent-teal opacity-40" />
            <p className="text-[0.9375rem] text-text-secondary leading-relaxed pr-8">
              {safetyMargin !== 0 && adjustedDuration <= 0 ? (
                `Avec une marge de ${safetyMargin} min, la porte serait fermée toute la journée.`
              ) : (
                <>
                  {day.advice}
                  {openWindowsWithDuration.length > 0 && (
                    <>
                      {' '}La porte est ouverte{' '}
                      {openWindowsWithDuration.map((w, wi) => (
                        <span key={wi}>
                          {wi > 0 && ' et '}
                          <span className="font-semibold text-status-open">
                            {formatDuration(w.durationMinutes)}
                          </span>
                          {' de '}
                          <span className="font-mono text-text-primary">{fmtTime(w.openTime)}</span>
                          {' à '}
                          <span className="font-mono text-text-primary">{fmtTime(w.closeTime)}</span>
                        </span>
                      ))}
                      .
                    </>
                  )}
                </>
              )}
            </p>

            {/* Durées par ouverture (ajustées de la marge) */}
            {adjustedDuration > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <Unlock className="w-4 h-4 text-status-open" />
                <span className="font-mono text-[0.875rem] text-text-accent">
                  {openWindowsWithDuration
                    .map((w) => `${w.openTime.getHours() < 12 ? 'Matin' : 'Soir'} ${formatDuration(w.durationMinutes)}`)
                    .join(' · ')}
                </span>
              </div>
            )}
            {adjustedDuration <= 0 && day.totalOpenDuration > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-status-closed" />
                <span className="font-mono text-[0.875rem] text-status-closed">
                  Porte fermée avec cette marge
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toggle Marge de Sécurité */}
      <div className="mt-6 pt-5 border-t border-[rgba(78,205,196,0.06)]">
        <p className="text-[0.9375rem] text-text-secondary mb-3">
          Simuler la marge de sécurité capitainerie
        </p>
        <div className="inline-flex bg-bg-surface rounded-lg p-1">
          {([0, -15, -30] as const).map((margin) => (
            <button
              key={margin}
              onClick={() => setSafetyMargin(margin)}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                ${safetyMargin === margin
                  ? 'bg-accent-teal/15 text-accent-teal border border-accent-teal/30'
                  : 'text-text-muted hover:text-text-secondary'
                }
              `}
            >
              {margin === 0 ? 'Aucune' : `${margin} min`}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Composant principal
// ============================================================

export default function Predictions() {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [sortColumn, setSortColumn] = useState<SortColumn>('day');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [days, setDays] = useState<DayPrediction[] | null>(null);
  const [source, setSource] = useState<TideSource>('shom');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    load7DaysData()
      .then((result) => {
        if (cancelled) return;
        setDays(result.days);
        setSource(result.source);
        setLastUpdated(new Date());
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSort = useCallback((col: SortColumn) => {
    setSortColumn(prev => {
      if (prev === col) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDirection('asc');
      return col;
    });
  }, []);

  if (!days) {
    return (
      <Layout lastUpdated={lastUpdated}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Waves className="w-8 h-8 text-accent-teal animate-pulse mx-auto mb-3" />
            <p className="text-text-secondary">Chargement des prévisions...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const selectedDay = days[selectedDayIndex];

  return (
    <Layout lastUpdated={lastUpdated}>
      <div className="space-y-8">
        {/* Avertissement si les données SHOM ne sont pas disponibles */}
        {source !== 'shom' && (
          <div className="flex items-start gap-2.5 bg-status-warning/10 border border-status-warning/25 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 flex-shrink-0" />
            <p className="text-[0.875rem] text-text-secondary">
              {source === 'openmeteo'
                ? 'Prédictions SHOM indisponibles — affichage d’une estimation calibrée (précision ±5 min / ±15 cm). Vérifier auprès de la capitainerie avant de sortir.'
                : 'Aucune source de données accessible — affichage de données fictives de démonstration. Ne pas utiliser pour naviguer.'}
            </p>
          </div>
        )}

        {/* Sélecteur de date fixe */}
        <DateSelector
          days={days}
          selectedIndex={selectedDayIndex}
          onSelect={setSelectedDayIndex}
        />

        {/* Contenu scrollable */}
        <div className="space-y-8 pt-4">
          {/* Section 2: Résumé Hebdomadaire */}
          <WeeklySummary
            days={days}
            onSelectDay={setSelectedDayIndex}
          />

          {/* Section 3: Tableau des Prévisions */}
          <PredictionsTable
            days={days}
            onSelectDay={setSelectedDayIndex}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />

          {/* Section 4: Vue Jour Détaillée */}
          <AnimatePresence mode="wait">
            {selectedDay && (
              <DayDetailView
                key={selectedDayIndex}
                day={selectedDay}
                dayIndex={selectedDayIndex}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
