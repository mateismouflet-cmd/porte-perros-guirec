import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Waves,
  ArrowUpDown,
  Gauge,
  Clock,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
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
  ReferenceDot,
  ReferenceArea,
} from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Layout from '@/components/Layout';
import {
  getTideDataForDate,
  getPressureCorrection,
  getInterpolatedHeight,
} from '@/lib/tideEngine';
import type { TideData, TideEvent, TideWindow, HourlyTideData } from '@/lib/tideEngine';

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

// ============================================================
// Formatting helpers
// ============================================================

function fmtTime(date: Date): string {
  return format(date, 'HH:mm', { locale: fr });
}

function fmtDate(date: Date): string {
  return format(date, 'EEEE d MMMM yyyy', { locale: fr });
}

// ============================================================
// Section 1: Status Card
// ============================================================

interface StatusCardProps {
  tideData: TideData;
  onRefresh: () => void;
  isLoading: boolean;
}

function CountdownTimer({ targetTime, label }: { targetTime: Date; label: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const remaining = Math.max(0, targetTime.getTime() - Date.now());
  const h = Math.floor(remaining / (1000 * 60 * 60));
  const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((remaining % (1000 * 60)) / 1000);

  return (
    <div className="mt-4">
      <p className="font-mono-label text-text-muted mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <div className="flex gap-1">
          {[
            { value: h, label: 'h' },
            { value: m, label: 'm' },
            { value: s, label: 's' },
          ].map((unit, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <div className="bg-bg-tertiary rounded-md px-2 py-1.5 min-w-[42px] text-center">
                <span className="font-mono text-2xl font-medium text-accent-teal">
                  {String(unit.value).padStart(2, '0')}
                </span>
              </div>
              {idx < 2 && (
                <span className="font-mono text-text-muted text-lg">:</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusCard({ tideData, onRefresh, isLoading }: StatusCardProps) {
  const isOpen = tideData.isOpen;
  const badgeText = isOpen ? 'PORTE OUVERTE' : 'PORTE FERMÉE';
  const badgeColor = isOpen
    ? 'text-status-open bg-[rgba(46,204,113,0.12)] border-[rgba(46,204,113,0.25)]'
    : 'text-status-closed bg-[rgba(231,76,60,0.12)] border-[rgba(231,76,60,0.25)]';
  const dotColor = isOpen ? 'bg-status-open' : 'bg-status-closed';

  let subStatus = '';
  if (isOpen) {
    const closeWindow = tideData.windows.find(
      (w) =>
        Date.now() >= w.openTime.getTime() &&
        Date.now() <= w.closeTime.getTime()
    );
    subStatus = closeWindow
      ? `Ouverte — fermeture prévue à ${fmtTime(closeWindow.closeTime)}`
      : 'Ouverte';
  } else {
    const nextOpen = tideData.windows.find(
      (w) => w.openTime.getTime() > Date.now()
    );
    subStatus = nextOpen
      ? `Fermée — prochaine ouverture à ${fmtTime(nextOpen.openTime)}`
      : 'Fermée';
  }

  return (
    <motion.div
      custom={0}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="gradient-surface rounded-2xl border border-[rgba(78,205,196,0.06)] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-[rgba(78,205,196,0.12)] hover:shadow-[0_0_20px_rgba(78,205,196,0.04)] transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-outfit font-semibold text-xl text-text-primary mb-2">
            Porte du port
          </p>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${badgeColor}`}
          >
            <span
              className={`relative flex h-2 w-2`}
            >
              <span
                className={`animate-pulse-dot absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}
              />
            </span>
            <span className="font-outfit font-semibold text-sm">{badgeText}</span>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-all duration-200"
          title="Actualiser"
        >
          <RefreshCw
            className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      <p className="text-text-secondary text-[0.9375rem] mb-2">{subStatus}</p>

      {tideData.nextEvent && (
        <CountdownTimer
          targetTime={tideData.nextEvent.time}
          label={
            tideData.nextEvent.type === 'open'
              ? 'Prochaine ouverture dans'
              : 'Fermeture dans'
          }
        />
      )}

      {/* Heure actuelle */}
      <div className="mt-4 pt-3 border-t border-[rgba(78,205,196,0.06)]">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-text-muted" />
          <span className="font-mono text-sm text-text-muted">
            {fmtTime(new Date())}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Section 2: Tide Chart
// ============================================================

interface ChartDataPoint {
  time: string;
  timeObj: Date;
  height: number;
  hourIndex: number;
}

function generateChartData(
  events: TideEvent[],
  curve: HourlyTideData[]
): ChartDataPoint[] {
  if (events.length < 2 && curve.length < 2) return [];

  // Interpolation linéaire sur la courbe SHOM (pas de 5 min) quand
  // disponible, sinon repli sur l'interpolation sinusoïdale entre PM/BM.
  const heightAt = (date: Date): number => {
    const t = date.getTime();
    if (
      curve.length >= 2 &&
      t >= curve[0].time.getTime() &&
      t <= curve[curve.length - 1].time.getTime()
    ) {
      let lo = 0;
      let hi = curve.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (curve[mid].time.getTime() <= t) lo = mid;
        else hi = mid;
      }
      const a = curve[lo];
      const b = curve[hi];
      const span = b.time.getTime() - a.time.getTime();
      if (span <= 0) return a.height;
      return a.height + ((b.height - a.height) * (t - a.time.getTime())) / span;
    }
    return getInterpolatedHeight(events, date);
  };

  const data: ChartDataPoint[] = [];
  for (let h = 0; h <= 23; h++) {
    for (let m = 0; m < 60; m += 10) {
      const date = new Date();
      date.setHours(h, m, 0, 0);
      data.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        timeObj: new Date(date),
        height: Math.round(heightAt(date) * 100) / 100,
        hourIndex: h,
      });
    }
  }

  return data;
}

/** Arrondit un horaire à la grille de 10 min du graphique (catégories X) */
function snapTimeStr(date: Date): string {
  const d = new Date(date);
  const snapped = Math.min(50, Math.round(d.getMinutes() / 10) * 10);
  d.setMinutes(snapped, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface TideChartProps {
  events: TideEvent[];
  windows: TideWindow[];
  coefficient: number;
  currentHeight: number;
  curve: HourlyTideData[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const isGateOpen = data.height >= 7.33;

  return (
    <div className="bg-bg-secondary border border-[rgba(78,205,196,0.15)] rounded-xl px-4 py-3 shadow-xl">
      <p className="font-mono text-sm text-text-primary mb-1">{data.time}</p>
      <p className="font-mono text-sm text-accent-teal mb-1">
        {data.height.toFixed(2)} m
      </p>
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
            isGateOpen
              ? 'bg-[rgba(46,204,113,0.15)] text-status-open'
              : 'bg-[rgba(231,76,60,0.15)] text-status-closed'
          }`}
        >
          {isGateOpen ? 'Porte ouverte' : 'Porte fermée'}
        </span>
      </div>
    </div>
  );
}

function TideChart({ events, windows, coefficient, curve }: TideChartProps) {
  const chartData = useMemo(() => generateChartData(events, curve), [events, curve]);

  const pmEvents = events.filter((e) => e.type === 'PM');
  const bmEvents = events.filter((e) => e.type === 'BM');

  // Position actuelle sur le graphique
  const now = new Date();
  const currentDataPoint = chartData.find(
    (d) =>
      d.timeObj.getHours() === now.getHours() &&
      d.timeObj.getMinutes() <= now.getMinutes() + 5 &&
      d.timeObj.getMinutes() >= now.getMinutes() - 5
  );

  const showCloseLow = coefficient < 70 && pmEvents.some((pm) => pm.height > 7.6);
  const showCloseHigh = coefficient >= 70 && pmEvents.some((pm) => pm.height > 8.0);

  return (
    <motion.div
      custom={1}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="gradient-surface rounded-2xl border border-[rgba(78,205,196,0.06)] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
    >
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-outfit font-semibold text-xl text-text-primary">
            Marégramme
          </h3>
          <p className="text-[0.9375rem] text-text-secondary">
            {fmtDate(new Date())}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
          <div className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-accent-teal rounded" />
            <span>Marée montante</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-accent-ocean rounded" />
            <span>Marée descendante</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-status-open rounded" />
            <span>Porte ouverte</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-0.5 border-t border-dashed border-[rgba(78,205,196,0.3)]" />
            <span>Seuil 7.33m</span>
          </div>
        </div>
      </div>

      {/* Graphique */}
      <div className="w-full" style={{ height: '360px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="tideGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ECDC4" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#2196F3" stopOpacity={0.05} />
              </linearGradient>
              <pattern
                id="openHatch"
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
              >
                <path
                  d="M0,8 L8,0"
                  stroke="rgba(46,204,113,0.15)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(78,205,196,0.04)"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              interval={11}
              tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#4A5E7D' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(78,205,196,0.08)' }}
            />

            <YAxis
              domain={[1, 10]}
              tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#4A5E7D' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}m`}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Zone d'ouverture */}
            {windows.map((w, i) => {
              const dayStart = new Date();
              dayStart.setHours(0, 0, 0, 0);
              const dayEnd = new Date();
              dayEnd.setHours(23, 50, 0, 0);
              const clamp = (d: Date) =>
                new Date(Math.min(Math.max(d.getTime(), dayStart.getTime()), dayEnd.getTime()));
              const openTimeStr = snapTimeStr(clamp(w.openTime));
              const closeTimeStr = snapTimeStr(clamp(w.closeTime));
              return (
                <ReferenceArea
                  key={i}
                  x1={openTimeStr}
                  x2={closeTimeStr}
                  y1={7.33}
                  y2={10}
                  fill="rgba(46,204,113,0.06)"
                  stroke="none"
                />
              );
            })}

            {/* Ligne d'ouverture 7.33m */}
            <ReferenceLine
              y={7.33}
              stroke="#2ECC71"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: 'Ouverture 7.33m',
                position: 'right',
                fill: '#2ECC71',
                fontSize: 10,
                fontFamily: 'JetBrains Mono',
              }}
            />

            {/* Ligne de fermeture basse 7.60m */}
            {showCloseLow && (
              <ReferenceLine
                y={7.6}
                stroke="#E74C3C"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: 'Fermeture 7.60m',
                  position: 'right',
                  fill: '#E74C3C',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                }}
              />
            )}

            {/* Ligne de fermeture haute 8.0m */}
            {showCloseHigh && (
              <ReferenceLine
                y={8.0}
                stroke="#E74C3C"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: 'Fermeture 8.0m',
                  position: 'right',
                  fill: '#E74C3C',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                }}
              />
            )}

            {/* Points PM */}
            {pmEvents.map((pm, i) => {
              const timeStr = fmtTime(pm.time);
              return (
                <ReferenceDot
                  key={`pm-${i}`}
                  x={snapTimeStr(pm.time)}
                  y={pm.height}
                  r={8}
                  fill="#4ECDC4"
                  stroke="#0F1D32"
                  strokeWidth={2}
                  label={{
                    value: `PM ${timeStr} — ${pm.height.toFixed(1)}m`,
                    position: 'top',
                    fill: '#4ECDC4',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
              );
            })}

            {/* Points BM */}
            {bmEvents.map((bm, i) => {
              const timeStr = fmtTime(bm.time);
              return (
                <ReferenceDot
                  key={`bm-${i}`}
                  x={snapTimeStr(bm.time)}
                  y={bm.height}
                  r={8}
                  fill="#2196F3"
                  stroke="#0F1D32"
                  strokeWidth={2}
                  label={{
                    value: `BM ${timeStr} — ${bm.height.toFixed(1)}m`,
                    position: 'bottom',
                    fill: '#2196F3',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
              );
            })}

            {/* Indicateur temps réel */}
            {currentDataPoint && (
              <ReferenceLine
                x={currentDataPoint.time}
                stroke="#FFD166"
                strokeOpacity={0.7}
                strokeWidth={1}
              />
            )}

            <Area
              type="monotone"
              dataKey="height"
              stroke="#4ECDC4"
              strokeWidth={2}
              fill="url(#tideGradient)"
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ============================================================
// Section 3: Metrics Row
// ============================================================

interface MetricsRowProps {
  tideData: TideData;
  pressureEnabled: boolean;
  onTogglePressure: () => void;
}

function MetricsRow({
  tideData,
  pressureEnabled,
  onTogglePressure,
}: MetricsRowProps) {
  const { events, coefficient, pressure, pressureCorrection } = tideData;

  // Marnage
  const marnage = useMemo(() => {
    const pms = events.filter((e) => e.type === 'PM');
    const bms = events.filter((e) => e.type === 'BM');
    if (pms.length > 0 && bms.length > 0) {
      return pms[0].height - bms[0].height;
    }
    return 0;
  }, [events]);

  // Type de marée — un coefficient par marée haute (ex : "49 / 52")
  const isViveEau = coefficient > 70;
  const coefColor = isViveEau ? 'text-sun-gold' : 'text-accent-teal';
  const coefLabel = isViveEau ? 'Vive-eau' : 'Morte-eau';
  const dayCoefs = events
    .filter((e) => e.type === 'PM' && e.coefficient !== undefined)
    .map((e) => e.coefficient);
  const coefValue = dayCoefs.length > 0 ? dayCoefs.join(' / ') : `${coefficient}`;

  // Label du prochain événement
  const getNextLabel = (): { text: string; color: string } => {
    if (!tideData.nextEvent) return { text: '—', color: 'text-text-muted' };
    if (tideData.nextEvent.type === 'open')
      return { text: 'Ouverture', color: 'text-status-open' };
    return { text: 'Fermeture', color: 'text-status-closed' };
  };

  const nextLabel = getNextLabel();

  const metrics = [
    {
      label: 'COEFFICIENT',
      value: coefValue,
      sub: coefLabel,
      color: coefColor,
      icon: <Waves className="w-5 h-5 text-text-muted" />,
    },
    {
      label: 'MARNAGE',
      value: `${marnage.toFixed(1)}m`,
      sub: "Hauteur d'eau max \u2212 min",
      color: 'text-accent-teal',
      icon: <ArrowUpDown className="w-5 h-5 text-text-muted" />,
    },
    {
      label: 'PRESSION',
      value: `${pressure} hPa`,
      sub:
        pressureCorrection !== 0
          ? `${pressureCorrection > 0 ? '+' : ''}${(pressureCorrection * 100).toFixed(0)} cm`
          : 'Pas de correction',
      color: 'text-accent-teal',
      icon: <Gauge className="w-5 h-5 text-text-muted" />,
      hasToggle: true,
    },
    {
      label: 'PROCHAIN',
      value: nextLabel.text,
      sub: tideData.nextEvent ? fmtTime(tideData.nextEvent.time) : '—',
      color: nextLabel.color,
      icon: <Clock className="w-5 h-5 text-text-muted" />,
    },
  ];

  return (
    <motion.div
      custom={2}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="gradient-surface rounded-2xl border border-[rgba(78,205,196,0.06)] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            custom={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: 0.2 + i * 0.06,
              duration: 0.35,
              ease: easeSmooth,
            }}
            className="flex flex-col"
          >
            <div className="flex items-center gap-1.5 mb-2">
              {m.icon}
              <span className="font-mono-label text-text-muted">{m.label}</span>
              {'hasToggle' in m && m.hasToggle && (
                <button
                  onClick={onTogglePressure}
                  className={`ml-auto relative w-8 h-4 rounded-full transition-colors duration-200 ${
                    pressureEnabled ? 'bg-accent-teal' : 'bg-bg-surface'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                      pressureEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              )}
            </div>
            <span className={`font-data-medium ${m.color}`}>{m.value}</span>
            <span className="text-[0.8125rem] text-text-muted mt-0.5">
              {m.sub}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// Section 4a: Détails PM/BM
// ============================================================

interface TideDetailsProps {
  events: TideEvent[];
}

function TideDetails({ events }: TideDetailsProps) {
  const pmEvents = events.filter((e) => e.type === 'PM');
  const bmEvents = events.filter((e) => e.type === 'BM');

  return (
    <motion.div
      custom={3}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="gradient-surface rounded-2xl border border-[rgba(78,205,196,0.06)] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
    >
      <h3 className="font-outfit font-semibold text-xl text-text-primary mb-4">
        Marées du jour
      </h3>

      <div className="space-y-4">
        {/* PM */}
        {pmEvents.map((pm, i) => (
          <motion.div
            key={`pm-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.1, duration: 0.35, ease: easeSmooth }}
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowUp className="w-4 h-4 text-accent-teal" />
              <span className="font-outfit font-semibold text-base text-text-secondary">
                Pleine Mer
              </span>
            </div>
            <div className="flex items-baseline gap-3 ml-6">
              <span className="font-data-medium text-text-primary">
                {fmtTime(pm.time)}
              </span>
              <span className="font-data-small text-accent-teal">
                {pm.height.toFixed(2)} m
              </span>
            </div>
            {i < pmEvents.length - 1 && (
              <div className="ml-6 mt-3 border-b border-[rgba(78,205,196,0.06)]" />
            )}
          </motion.div>
        ))}

        {/* BM */}
        {bmEvents.map((bm, i) => (
          <motion.div
            key={`bm-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1, duration: 0.35, ease: easeSmooth }}
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowDown className="w-4 h-4 text-accent-ocean" />
              <span className="font-outfit font-semibold text-base text-text-secondary">
                Basse Mer
              </span>
            </div>
            <div className="flex items-baseline gap-3 ml-6">
              <span className="font-data-medium text-text-primary">
                {fmtTime(bm.time)}
              </span>
              <span className="font-data-small text-accent-ocean">
                {bm.height.toFixed(2)} m
              </span>
            </div>
            {i < bmEvents.length - 1 && (
              <div className="ml-6 mt-3 border-b border-[rgba(78,205,196,0.06)]" />
            )}
          </motion.div>
        ))}
      </div>

      <p className="mt-4 pt-3 border-t border-[rgba(78,205,196,0.06)] text-[0.8125rem] text-text-muted">
        Corrections Perros-Guirec appliquées (SHOM)
        <a
          href="https://maree.shom.fr/harbor/PERROS-GUIREC_TRESTRAOU/hlt/0"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 ml-1.5 text-accent-teal hover:text-accent-teal/80 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </motion.div>
  );
}

// ============================================================
// Section 4b: Timeline
// ============================================================

interface TimelineProps {
  events: TideEvent[];
  windows: TideWindow[];
}

interface TimelineItem {
  time: Date;
  label: string;
  detail: string;
  color: string;
  icon: 'BM' | 'PM' | 'open' | 'close';
}

function Timeline({ events, windows }: TimelineProps) {
  const items = useMemo<TimelineItem[]>(() => {
    const result: TimelineItem[] = [];

    for (const e of events) {
      if (e.type === 'BM') {
        result.push({
          time: e.time,
          label: `BM ${fmtTime(e.time)}`,
          detail: `${e.height.toFixed(2)} m`,
          color: '#2196F3',
          icon: 'BM',
        });
      } else {
        result.push({
          time: e.time,
          label: `PM ${fmtTime(e.time)}`,
          detail: `${e.height.toFixed(2)} m`,
          color: '#4ECDC4',
          icon: 'PM',
        });
      }
    }

    for (const w of windows) {
      result.push({
        time: w.openTime,
        label: `Ouverture ${fmtTime(w.openTime)}`,
        detail: 'Seuil 7.33m atteint',
        color: '#2ECC71',
        icon: 'open',
      });
      result.push({
        time: w.closeTime,
        label: `Fermeture ${fmtTime(w.closeTime)}`,
        detail: `${w.durationMinutes.toFixed(0)} min de plage`,
        color: '#E74C3C',
        icon: 'close',
      });
    }

    result.sort((a, b) => a.time.getTime() - b.time.getTime());
    return result;
  }, [events, windows]);

  // Position proportionnelle dans la journée (0-100%)
  const getPosition = (time: Date): number => {
    const hours = time.getHours() + time.getMinutes() / 60;
    return (hours / 24) * 100;
  };

  // Répartit les étiquettes sur 3 étages pour éviter les chevauchements
  // quand plusieurs événements tombent à quelques minutes d'écart
  const positionedItems = useMemo(() => {
    const lastLabelPos: number[] = [];
    const MIN_GAP = 9; // % de largeur sous lequel deux étiquettes se chevauchent
    return items.map((item) => {
      const pos = getPosition(item.time);
      let tier = 0;
      while (
        tier < 2 &&
        lastLabelPos[tier] !== undefined &&
        pos - lastLabelPos[tier] < MIN_GAP
      ) {
        tier++;
      }
      lastLabelPos[tier] = pos;
      return { ...item, pos, tier };
    });
  }, [items]);

  const now = new Date();
  const nowPosition = getPosition(now);

  return (
    <motion.div
      custom={4}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="gradient-surface rounded-2xl border border-[rgba(78,205,196,0.06)] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
    >
      <h3 className="font-outfit font-semibold text-xl text-text-primary mb-1">
        Chronologie de la journée
      </h3>
      <p className="text-[0.9375rem] text-text-secondary mb-6">
        Les horaires réels calculés sans marge de sécurité
      </p>

      {/* Timeline bar */}
      <div className="relative mb-8 mt-20">
        {/* Barre de fond */}
        <div className="h-2 bg-bg-surface rounded-full w-full relative">
          {/* Plages d'ouverture */}
          {windows.map((w, i) => {
            const start = getPosition(w.openTime);
            const end = getPosition(w.closeTime);
            return (
              <div
                key={i}
                className="absolute h-full rounded-full bg-[rgba(46,204,113,0.3)]"
                style={{
                  left: `${start}%`,
                  width: `${end - start}%`,
                }}
              />
            );
          })}
        </div>

        {/* Points d'événements + étiquettes étagées */}
        {positionedItems.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.08, duration: 0.3 }}
          >
            {/* Trait de rappel vers l'étiquette */}
            <div
              className="absolute -translate-x-1/2 w-px"
              style={{
                left: `${item.pos}%`,
                bottom: '12px',
                height: `${6 + item.tier * 22}px`,
                backgroundColor: `${item.color}50`,
              }}
            />
            {/* Étiquette */}
            <div
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{
                left: `${item.pos}%`,
                bottom: `${18 + item.tier * 22}px`,
              }}
            >
              <span
                className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  color: item.color,
                  backgroundColor: `${item.color}15`,
                }}
              >
                {item.label}
              </span>
            </div>
            {/* Point sur la barre */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-bg-primary"
              style={{
                left: `${item.pos}%`,
                backgroundColor: item.color,
              }}
            />
          </motion.div>
        ))}

        {/* Indicateur heure actuelle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${nowPosition}%` }}
        >
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-sun-gold -mt-2" />
          <div className="w-0.5 h-4 bg-sun-gold/70 mx-auto" />
        </motion.div>
      </div>

      {/* Échelle horaire */}
      <div className="relative h-4 mb-4">
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
          <div
            key={h}
            className="absolute -translate-x-1/2"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            <span className="font-mono text-[10px] text-text-muted">
              {String(h).padStart(2, '0')}h
            </span>
          </div>
        ))}
      </div>

      {/* Tableau récapitulatif */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[rgba(78,205,196,0.06)]">
              <th className="text-left py-2 px-3 font-mono-label text-text-muted">
                Événement
              </th>
              <th className="text-left py-2 px-3 font-mono-label text-text-muted">
                Heure
              </th>
              <th className="text-left py-2 px-3 font-mono-label text-text-muted">
                Hauteur
              </th>
              <th className="text-left py-2 px-3 font-mono-label text-text-muted">
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr
                key={`evt-${i}`}
                className={`border-b border-[rgba(78,205,196,0.04)] ${
                  i % 2 === 0 ? 'bg-bg-primary/30' : 'bg-bg-secondary/30'
                }`}
              >
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    {e.type === 'PM' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-accent-teal" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-accent-ocean" />
                    )}
                    <span className="font-medium text-text-primary">
                      {e.type === 'PM' ? 'Pleine Mer' : 'Basse Mer'}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3 font-mono text-text-primary">
                  {fmtTime(e.time)}
                </td>
                <td className="py-2.5 px-3 font-mono text-accent-teal">
                  {e.height.toFixed(2)} m
                </td>
                <td className="py-2.5 px-3 text-text-muted">—</td>
              </tr>
            ))}
            {windows.map((w, i) => (
              <tr key={`win-${i}`} className="border-b border-[rgba(78,205,196,0.04)] bg-[rgba(46,204,113,0.04)]">
                <td className="py-2.5 px-3 border-l-[3px] border-status-open">
                  <div className="flex items-center gap-1.5">
                    <Unlock className="w-3.5 h-3.5 text-status-open" />
                    <span className="font-medium text-status-open">
                      Ouverture
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3 font-mono text-text-primary">
                  {fmtTime(w.openTime)}
                </td>
                <td className="py-2.5 px-3 font-mono text-text-accent">
                  7.33 m
                </td>
                <td className="py-2.5 px-3 text-text-muted">
                  Seuil atteint (montée)
                </td>
              </tr>
            ))}
            {windows.map((w, i) => (
              <tr key={`winc-${i}`} className="border-b border-[rgba(78,205,196,0.04)] bg-[rgba(231,76,60,0.04)]">
                <td className="py-2.5 px-3 border-l-[3px] border-status-closed">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-status-closed" />
                    <span className="font-medium text-status-closed">
                      Fermeture
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3 font-mono text-text-primary">
                  {fmtTime(w.closeTime)}
                </td>
                <td className="py-2.5 px-3 font-mono text-text-accent">
                  —
                </td>
                <td className="py-2.5 px-3 text-text-muted">
                  {w.durationMinutes.toFixed(0)} min de plage
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ============================================================
// Section: Pression barométrique
// ============================================================

interface PressureSectionProps {
  pressure: number;
  measuredPressure: number;
  enabled: boolean;
  onToggle: () => void;
  onPressureChange: (p: number) => void;
  onResetToMeasured: () => void;
  correction: number;
}

function PressureSection({
  pressure,
  measuredPressure,
  enabled,
  onToggle,
  onPressureChange,
  onResetToMeasured,
  correction,
}: PressureSectionProps) {
  // Le curseur est-il calé sur la pression réelle mesurée du jour ?
  const isOnMeasured = pressure === measuredPressure;

  return (
    <motion.div
      custom={5}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="gradient-surface rounded-2xl border border-[rgba(78,205,196,0.06)] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-text-muted" />
          <h3 className="font-outfit font-semibold text-lg text-text-primary">
            Correction barométrique
          </h3>
        </div>
        <button
          onClick={onToggle}
          className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
            enabled ? 'bg-accent-teal' : 'bg-bg-surface'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Pression réelle mesurée (donnée auto), toujours visible */}
      <div className="flex items-center justify-between mb-3 text-[0.8125rem]">
        <span className="text-text-secondary">
          Pression mesurée à Perros actuellement
        </span>
        <span className="font-mono text-text-accent">{measuredPressure} hPa</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono-label text-text-muted">
              Pression utilisée pour le calcul
            </span>
            <span className="font-mono text-sm text-text-accent">
              {pressure} hPa
            </span>
          </div>
          <input
            type="range"
            min={970}
            max={1040}
            value={pressure}
            onChange={(e) => onPressureChange(Number(e.target.value))}
            disabled={!enabled}
            className="w-full h-1.5 bg-bg-surface rounded-full appearance-none cursor-pointer accent-accent-teal disabled:opacity-50"
          />
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[10px] text-text-muted">970</span>
            {enabled && !isOnMeasured && (
              <button
                onClick={onResetToMeasured}
                className="flex items-center gap-1 text-[10px] text-accent-teal hover:brightness-110 transition-all"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Revenir à la pression réelle
              </button>
            )}
            <span className="font-mono text-[10px] text-text-muted">1040</span>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-primary/50">
          <span className="font-mono-label text-text-muted">Impact</span>
          <span
            className={`font-mono text-sm font-medium ${
              correction <= 0 ? 'text-status-open' : 'text-status-warning'
            }`}
          >
            {correction > 0 ? '+' : ''}
            {(correction * 100).toFixed(0)} cm
          </span>
          {!enabled && (
            <span className="text-[10px] text-text-muted ml-1">(désactivé)</span>
          )}
        </div>
      </div>

      <p className="mt-3 text-[0.8125rem] text-text-muted flex items-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        {enabled
          ? 'Activée : les hauteurs et horaires de porte sont corrigés avec la pression ci-dessus (par défaut, la pression réelle du jour). Une pression élevée abaisse le niveau de la mer, une dépression l’élève.'
          : 'Désactivée : aucune correction n’est appliquée. Activer pour corriger les horaires avec la pression réelle du jour (ajustable). Δh = -(P - 1013.25) × 0.01'}
      </p>
    </motion.div>
  );
}

// ============================================================
// Page principale
// ============================================================

export default function Home() {
  const [tideData, setTideData] = useState<TideData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pressureEnabled, setPressureEnabled] = useState(false);
  const [manualPressure, setManualPressure] = useState(1013);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Au premier chargement, on cale le curseur sur la pression réelle mesurée
  // (donnée auto de la météo) ; ensuite l'utilisateur peut l'ajuster librement.
  const pressureInitialized = useRef(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const correction = pressureEnabled
        ? getPressureCorrection(manualPressure)
        : 0;
      const data = await getTideDataForDate(new Date(), correction);
      setTideData(data);
      setLastUpdated(new Date());
    } catch {
      setError('Impossible de récupérer les données marégraphiques.');
    } finally {
      setIsLoading(false);
    }
  }, [pressureEnabled, manualPressure]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Caler le curseur sur la pression réelle mesurée, une seule fois,
  // dès que les premières données arrivent.
  useEffect(() => {
    if (tideData && !pressureInitialized.current) {
      pressureInitialized.current = true;
      setManualPressure(tideData.pressure);
    }
  }, [tideData]);

  // Auto-refresh toutes les 5 minutes
  useEffect(() => {
    const iv = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loadData]);

  if (isLoading && !tideData) {
    return (
      <Layout lastUpdated={lastUpdated}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Waves className="w-8 h-8 text-accent-teal animate-pulse mx-auto mb-3" />
            <p className="text-text-secondary">Chargement des données...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error && !tideData) {
    return (
      <Layout lastUpdated={lastUpdated}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center bg-[rgba(231,76,60,0.1)] border border-[rgba(231,76,60,0.2)] rounded-2xl p-6 max-w-md">
            <AlertTriangle className="w-8 h-8 text-status-closed mx-auto mb-3" />
            <p className="text-text-primary mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-accent-teal text-bg-primary font-outfit font-semibold rounded-lg hover:brightness-110 transition-all"
            >
              Réessayer
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!tideData) return null;

  return (
    <Layout lastUpdated={lastUpdated}>
      {/* Titre de page */}
      <div className="mb-6">
        <h1 className="font-outfit font-bold text-[2.5rem] text-text-primary tracking-tight leading-tight">
          Prévisions horaires du seuil basculant
        </h1>
        <p className="text-text-secondary text-[0.9375rem] mt-1 capitalize">
          {fmtDate(new Date())}
        </p>
        <p className="text-[0.8125rem] text-text-muted mt-1">
          {tideData.source === 'shom'
            ? 'Source : prédictions officielles SHOM (Perros-Guirec)'
            : tideData.source === 'openmeteo'
              ? 'Source : estimation Open-Meteo calibrée — SHOM indisponible'
              : 'Source : données de démonstration — aucune API accessible'}
        </p>
      </div>

      {/* Avertissement données dégradées */}
      {tideData.source !== 'shom' && (
        <div className="mb-6 flex items-start gap-2.5 bg-status-warning/10 border border-status-warning/25 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 flex-shrink-0" />
          <p className="text-[0.875rem] text-text-secondary">
            {tideData.source === 'openmeteo'
              ? 'Les prédictions officielles SHOM sont indisponibles. Les horaires affichés sont une estimation (précision ±5 min / ±15 cm) — vérifier auprès de la capitainerie avant de sortir.'
              : 'Aucune source de données accessible — les horaires affichés sont fictifs. Ne pas utiliser pour naviguer.'}
          </p>
        </div>
      )}

      {/* Layout grille */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne gauche */}
        <div className="flex flex-col gap-6">
          <StatusCard
            tideData={tideData}
            onRefresh={loadData}
            isLoading={isLoading}
          />
          <MetricsRow
            tideData={tideData}
            pressureEnabled={pressureEnabled}
            onTogglePressure={() => setPressureEnabled((v) => !v)}
          />
          <PressureSection
            pressure={manualPressure}
            measuredPressure={tideData.pressure}
            enabled={pressureEnabled}
            onToggle={() => setPressureEnabled((v) => !v)}
            onPressureChange={setManualPressure}
            onResetToMeasured={() => setManualPressure(tideData.pressure)}
            correction={getPressureCorrection(manualPressure)}
          />
        </div>

        {/* Colonne droite */}
        <div className="flex flex-col gap-6">
          <TideChart
            events={tideData.events}
            windows={tideData.windows}
            coefficient={tideData.coefficient}
            currentHeight={tideData.currentHeight}
            curve={tideData.curve}
          />
          <TideDetails events={tideData.events} />
        </div>
      </div>

      {/* Règles de bascule de la porte */}
      <div className="mt-6">
        <div className="gradient-surface rounded-2xl border border-[rgba(78,205,196,0.06)] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
          <h3 className="font-outfit font-semibold text-xl text-text-primary mb-1">
            Conditions de déclenchement du seuil
          </h3>
          <p className="text-[0.9375rem] text-text-secondary mb-4">
            L’automate ouvre et ferme la porte selon la hauteur d’eau. Voici les
            règles de bascule qui produisent les horaires présentés.
          </p>

          <div className="flex items-start gap-2.5 mb-3">
            <Unlock className="w-4 h-4 text-status-open mt-0.5 flex-shrink-0" />
            <p className="text-[0.9375rem] text-text-secondary">
              <span className="text-text-primary font-medium">Ouverture</span> :
              quand la marée montante franchit{' '}
              <span className="font-mono text-text-accent">7,33 m</span>.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-status-closed mt-0.5 flex-shrink-0" />
            <div className="text-[0.9375rem] text-text-secondary">
              <span className="text-text-primary font-medium">Fermeture</span>,
              selon la pleine mer (PM) et le coefficient :
              <ul className="mt-1.5 space-y-1 list-disc list-inside marker:text-text-muted">
                <li>
                  <span className="text-text-primary font-medium">PM ≤ 7,60 m</span> →
                  fermeture <span className="font-mono text-text-accent">à la pleine mer</span> ;
                </li>
                <li>
                  <span className="text-text-primary font-medium">PM &gt; 7,60 m et coef &lt; 70</span> →
                  fermeture sur la descente à{' '}
                  <span className="font-mono text-text-accent">7,60 m</span> ;
                </li>
                <li>
                  <span className="text-text-primary font-medium">PM &gt; 7,60 m et coef ≥ 70</span> →
                  fermeture sur la descente à{' '}
                  <span className="font-mono text-text-accent">8,00 m</span>.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline - pleine largeur */}
      <div className="mt-6">
        <Timeline events={tideData.events} windows={tideData.windows} />
      </div>
    </Layout>
  );
}
