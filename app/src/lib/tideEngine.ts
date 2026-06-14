/**
 * Moteur de calcul des marées pour Perros-Guirec
 *
 * Source primaire : prédictions officielles SHOM (port principal
 * PERROS-GUIREC_TRESTRAOU) — heures/hauteurs PM-BM, coefficients officiels
 * et courbe de hauteur d'eau au pas de 5 minutes, référencée au zéro
 * hydrographique (la même référence que les seuils de l'automate de la porte).
 * L'API SHOM exige un Referer "maree.shom.fr" : les appels passent par le
 * proxy Vite `/api/shom` (voir vite.config.ts).
 *
 * Repli : Open-Meteo Marine (`sea_level_height_msl`). Ces hauteurs sont
 * référencées au niveau moyen et la phase du modèle est en avance ; on
 * applique une calibration mesurée contre le SHOM (juin 2026) :
 * +38 min sur les heures, +5.9 m sur les hauteurs. Précision ≈ ±5 min/±15 cm,
 * signalée comme dégradée via `TideData.source`.
 *
 * Dernier recours : une journée type embarquée (source 'mock').
 */

// ============================================================
// Types
// ============================================================

export interface TideEvent {
  time: Date;
  type: 'PM' | 'BM';
  height: number; // mètres au-dessus du zéro hydrographique
  /** Coefficient officiel SHOM (uniquement sur les PM, si source = shom) */
  coefficient?: number;
}

export interface TideWindow {
  openTime: Date;
  closeTime: Date;
  durationMinutes: number;
}

export interface HourlyTideData {
  time: Date;
  height: number;
}

export interface HourlyPressure {
  time: Date;
  pressure: number;
}

export type TideSource = 'shom' | 'openmeteo' | 'mock';

export interface TideData {
  events: TideEvent[];
  windows: TideWindow[];
  coefficient: number;
  currentHeight: number;
  isOpen: boolean;
  nextEvent: { type: 'open' | 'close'; time: Date } | null;
  pressure: number;
  pressureCorrection: number;
  /** Provenance réelle des données affichées */
  source: TideSource;
  /** Courbe de hauteur d'eau du jour (pas 5 min si SHOM) pour les graphiques */
  curve: HourlyTideData[];
}

// ============================================================
// Constantes (règles de l'automate + calibration)
// ============================================================

/** Seuil d'ouverture de la porte (marée montante) */
export const GATE_OPEN_HEIGHT = 7.33;
/** Seuil de fermeture à marée descendante, coefficient < 70 */
export const GATE_CLOSE_LOW = 7.6;
/** Seuil de fermeture à marée descendante, coefficient >= 70 */
export const GATE_CLOSE_HIGH = 8.0;
/** Coefficient charnière vive-eau / morte-eau */
export const COEF_THRESHOLD = 70;

const SHOM_PROXY = '/api/shom';
const SHOM_HARBOR = 'PERROS-GUIREC_TRESTRAOU';

// Calibration du repli Open-Meteo, mesurée contre le SHOM (stable à ±3 min /
// ±10 cm sur coefficients 49 → 93) : le modèle est en avance de ~38 min et
// référencé au niveau moyen (~5.9 m au-dessus du zéro hydrographique).
const OM_TIME_SHIFT_MIN = 38;
const OM_HEIGHT_OFFSET = 5.9;

// Unité de hauteur approximative de Perros-Guirec (semi-marnage à coef 100),
// calibrée sur les coefficients officiels SHOM. Utilisée seulement quand le
// coefficient officiel n'est pas disponible.
const PERROS_HEIGHT_UNIT = 4.3;

// ============================================================
// Données de secours réalistes (Perros-Guirec)
// ============================================================

const MOCK_HEIGHTS = [
  5.82, 4.65, 3.58, 2.72, 2.15, 1.98, 2.21, 2.92, 4.01, 5.35, 6.72, 7.85,
  8.52, 8.55, 8.08, 7.18, 6.02, 4.78, 3.62, 2.68, 2.05, 1.85, 2.18, 3.02,
];

function generateMockDataForDate(date: Date): HourlyTideData[] {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return MOCK_HEIGHTS.map((height, i) => ({
    time: new Date(day.getTime() + i * 3600 * 1000),
    height,
  }));
}

// ============================================================
// Utilitaires de date
// ============================================================

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ============================================================
// Cache localStorage
// ============================================================

interface CacheEntry {
  timestamp: number;
  data: unknown;
}

function getCached<T>(key: string, ttlMinutes: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > ttlMinutes * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data as T;
  } catch {
    return null;
  }
}

function setCache(key: string, data: unknown): void {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignorer les erreurs de localStorage (quota, navigation privée…)
  }
}

// ============================================================
// Source primaire : SHOM
// ============================================================

// Les heures SHOM demandées en "utc=standard" sont en HEURE LÉGALE française
// (vérifié le 10/06/2026 contre maree.info et le programme de la capitainerie :
// PM 14:44 — ce n'est PAS de l'UTC+1, ne pas ajouter d'offset). On parse donc
// en heure locale du navigateur, l'app étant destinée à un usage en France.
const SHOM_CACHE_TTL_MIN = 7 * 24 * 60; // les prédictions sont déterministes

interface ShomDayRaw {
  /** lignes hlt : [type, "HH:MM", "H.HH", coef] */
  hlt: [string, string, string, string][];
  /** points wl : ["HH:MM:SS", hauteur] */
  wl: [string, number][];
}

function shomDayCacheKey(dayKey: string): string {
  return `shom-day-v2-${dayKey}`;
}

async function fetchShomSpan(startKey: string, duration: number): Promise<void> {
  const base = `harborName=${SHOM_HARBOR}&duration=${duration}&date=${startKey}&utc=standard`;
  const [hltRes, wlRes] = await Promise.all([
    fetch(`${SHOM_PROXY}/spm/hlt?${base}&correlation=1`),
    fetch(`${SHOM_PROXY}/spm/wl?${base}&nbWaterLevels=288`),
  ]);
  if (!hltRes.ok || !wlRes.ok) throw new Error('API SHOM indisponible');
  const hlt: Record<string, [string, string, string, string][]> = await hltRes.json();
  const wl: Record<string, [string, number][]> = await wlRes.json();

  for (const dayKey of Object.keys(wl)) {
    const raw: ShomDayRaw = { hlt: hlt[dayKey] ?? [], wl: wl[dayKey] ?? [] };
    if (raw.wl.length > 0) setCache(shomDayCacheKey(dayKey), raw);
  }
}

/**
 * Garantit la présence en cache des jours SHOM [start, start + count - 1].
 * Une seule requête pour tout l'intervalle manquant.
 */
let shomUnavailableUntil = 0;

async function ensureShomDays(start: Date, count: number): Promise<boolean> {
  const missing: string[] = [];
  for (let i = 0; i < count; i++) {
    const key = formatDateKey(addDays(start, i));
    if (!getCached<ShomDayRaw>(shomDayCacheKey(key), SHOM_CACHE_TTL_MIN)) {
      missing.push(key);
    }
  }
  if (missing.length === 0) return true;
  if (Date.now() < shomUnavailableUntil) return false;

  try {
    const first = missing[0];
    const last = missing[missing.length - 1];
    const span =
      Math.round(
        (new Date(`${last}T00:00:00`).getTime() -
          new Date(`${first}T00:00:00`).getTime()) /
          86400000
      ) + 1;
    await fetchShomSpan(first, span);
    // Vérifier que tout est bien arrivé
    return missing.every(
      (k) => getCached<ShomDayRaw>(shomDayCacheKey(k), SHOM_CACHE_TTL_MIN) !== null
    );
  } catch {
    // Ne pas réessayer pendant 5 minutes (proxy absent en hébergement statique)
    shomUnavailableUntil = Date.now() + 5 * 60 * 1000;
    return false;
  }
}

function parseShomDay(dayKey: string, raw: ShomDayRaw): {
  events: TideEvent[];
  curve: HourlyTideData[];
} {
  const events: TideEvent[] = [];
  for (const [type, time, height, coef] of raw.hlt) {
    if (time === '--:--') continue; // "tide.none"
    const h = parseFloat(height);
    if (!Number.isFinite(h)) continue;
    const parsedCoef = parseInt(coef, 10);
    events.push({
      time: new Date(`${dayKey}T${time}:00`),
      type: type === 'tide.high' ? 'PM' : 'BM',
      height: h,
      coefficient: Number.isFinite(parsedCoef) ? parsedCoef : undefined,
    });
  }
  const curve: HourlyTideData[] = raw.wl.map(([time, h]) => ({
    time: new Date(`${dayKey}T${time}`),
    height: h,
  }));
  return { events, curve };
}

/**
 * Charge les données SHOM couvrant [date - 1, date + 1] (nécessaire pour les
 * fenêtres à cheval sur minuit et le passage heure standard → heure locale).
 */
async function getShomRange(date: Date): Promise<{
  events: TideEvent[];
  curve: HourlyTideData[];
} | null> {
  const start = addDays(date, -1);
  const ok = await ensureShomDays(start, 3);
  if (!ok) return null;

  const events: TideEvent[] = [];
  const curve: HourlyTideData[] = [];
  for (let i = 0; i < 3; i++) {
    const key = formatDateKey(addDays(start, i));
    const raw = getCached<ShomDayRaw>(shomDayCacheKey(key), SHOM_CACHE_TTL_MIN);
    if (!raw) return null;
    const parsed = parseShomDay(key, raw);
    events.push(...parsed.events);
    curve.push(...parsed.curve);
  }
  events.sort((a, b) => a.time.getTime() - b.time.getTime());
  curve.sort((a, b) => a.time.getTime() - b.time.getTime());
  return { events, curve };
}

// ============================================================
// Source de repli : Open-Meteo Marine (calibrée sur le SHOM)
// ============================================================

async function getOpenMeteoRange(date: Date): Promise<{
  events: TideEvent[];
  curve: HourlyTideData[];
} | null> {
  const startKey = formatDateKey(addDays(date, -1));
  const endKey = formatDateKey(addDays(date, 1));
  const cacheKey = `om-range-v2-${startKey}`;

  let raw = getCached<{ times: string[]; heights: number[] }>(cacheKey, 30);
  if (!raw) {
    try {
      const url =
        `https://marine-api.open-meteo.com/v1/marine?latitude=48.8167&longitude=-3.45` +
        `&hourly=sea_level_height_msl&timezone=Europe%2FParis` +
        `&start_date=${startKey}&end_date=${endKey}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('API marine indisponible');
      const json = await response.json();
      const times: string[] = json.hourly?.time ?? [];
      const heights: number[] = json.hourly?.sea_level_height_msl ?? [];
      if (times.length === 0 || heights.length === 0) throw new Error('vide');
      raw = { times, heights };
      setCache(cacheKey, raw);
    } catch {
      return null;
    }
  }

  // Calibration : décalage temporel + passage au zéro hydrographique
  const hourly: HourlyTideData[] = raw.times.map((t, i) => ({
    time: new Date(new Date(t).getTime() + OM_TIME_SHIFT_MIN * 60 * 1000),
    height: (raw.heights[i] ?? 0) + OM_HEIGHT_OFFSET,
  }));

  // PM/BM par extrema locaux affinés par interpolation parabolique
  const events: TideEvent[] = [];
  for (let i = 1; i < hourly.length - 1; i++) {
    const a = hourly[i - 1].height;
    const b = hourly[i].height;
    const c = hourly[i + 1].height;
    const isMax = b > a && b > c;
    const isMin = b < a && b < c;
    if (!isMax && !isMin) continue;
    const denom = a - 2 * b + c;
    const offset = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    events.push({
      time: new Date(hourly[i].time.getTime() + offset * 3600 * 1000),
      type: isMax ? 'PM' : 'BM',
      height: b - 0.25 * (a - c) * offset,
    });
  }
  if (events.length < 2) return null;

  // Courbe au pas de 5 min par interpolation sinusoïdale entre extrema
  const curve: HourlyTideData[] = [];
  const start = events[0].time.getTime();
  const end = events[events.length - 1].time.getTime();
  for (let t = start; t <= end; t += 5 * 60 * 1000) {
    const time = new Date(t);
    curve.push({ time, height: getInterpolatedHeight(events, time) });
  }
  return { events, curve };
}

// ============================================================
// Dernier recours : journée type embarquée
// ============================================================

function getMockRange(date: Date): { events: TideEvent[]; curve: HourlyTideData[] } {
  const hourly = [
    ...generateMockDataForDate(addDays(date, -1)),
    ...generateMockDataForDate(date),
    ...generateMockDataForDate(addDays(date, 1)),
  ];
  const events = detectPMBM(hourly);
  const curve: HourlyTideData[] = [];
  if (events.length >= 2) {
    const start = events[0].time.getTime();
    const end = events[events.length - 1].time.getTime();
    for (let t = start; t <= end; t += 5 * 60 * 1000) {
      const time = new Date(t);
      curve.push({ time, height: getInterpolatedHeight(events, time) });
    }
  }
  return { events, curve };
}

// ============================================================
// Pression atmosphérique (Open-Meteo Weather)
// ============================================================

export async function fetchPressure(date: Date): Promise<HourlyPressure[]> {
  const dateKey = formatDateKey(date);
  const cacheKey = `pressure-v2-${dateKey}`;

  const cached = getCached<{ times: string[]; pressures: number[] }>(cacheKey, 30);
  if (cached) {
    return cached.times.map((t, i) => ({
      time: new Date(t),
      pressure: cached.pressures[i] ?? 1013.25,
    }));
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=48.8167&longitude=-3.45` +
      `&hourly=surface_pressure&timezone=Europe%2FParis` +
      `&start_date=${dateKey}&end_date=${dateKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API météo indisponible');
    const json = await response.json();
    const times: string[] = json.hourly?.time ?? [];
    const pressures: number[] = json.hourly?.surface_pressure ?? [];
    if (times.length === 0 || pressures.length === 0) throw new Error('vide');
    setCache(cacheKey, { times, pressures });
    return times.map((t, i) => ({
      time: new Date(t),
      pressure: pressures[i] ?? 1013.25,
    }));
  } catch {
    return generateMockDataForDate(date).map((d) => ({
      time: d.time,
      pressure: 1013.25,
    }));
  }
}

// ============================================================
// Détection PM/BM (utilisée par le repli et les données mock)
// ============================================================

export function detectPMBM(heights: HourlyTideData[]): TideEvent[] {
  const events: TideEvent[] = [];
  for (let i = 1; i < heights.length - 1; i++) {
    const prev = heights[i - 1].height;
    const curr = heights[i].height;
    const next = heights[i + 1].height;
    if (curr > prev && curr > next) {
      events.push({ time: heights[i].time, type: 'PM', height: curr });
    } else if (curr < prev && curr < next) {
      events.push({ time: heights[i].time, type: 'BM', height: curr });
    }
  }
  events.sort((a, b) => a.time.getTime() - b.time.getTime());
  return events;
}

// ============================================================
// Coefficient de marée (approximation locale)
// ============================================================

/**
 * Approximation du coefficient à partir du semi-marnage de Perros-Guirec,
 * calibrée sur les coefficients officiels SHOM (±2 points sur coef 49 → 93).
 * Utilisée seulement quand le coefficient officiel n'est pas disponible.
 */
export function calculateCoefficient(pmHeight: number, bmHeight: number): number {
  return (((pmHeight - bmHeight) / 2) / PERROS_HEIGHT_UNIT) * 100;
}

// ============================================================
// Interpolation sinusoidale (repli quand pas de courbe SHOM)
// ============================================================

export function interpolateHeight(
  bm: TideEvent,
  pm: TideEvent,
  targetTime: Date
): number {
  const T = (pm.time.getTime() - bm.time.getTime()) / (1000 * 60 * 60);
  const t = (targetTime.getTime() - bm.time.getTime()) / (1000 * 60 * 60);
  if (T <= 0) return bm.height;
  const M = pm.height - bm.height;
  const clampedT = Math.max(0, Math.min(T, t));
  return bm.height + (M / 2) * (1 - Math.cos((Math.PI * clampedT) / T));
}

function interpolateHeightDesc(
  pm: TideEvent,
  bm: TideEvent,
  targetTime: Date
): number {
  const T = (bm.time.getTime() - pm.time.getTime()) / (1000 * 60 * 60);
  const t = (targetTime.getTime() - pm.time.getTime()) / (1000 * 60 * 60);
  if (T <= 0) return pm.height;
  const M = pm.height - bm.height;
  const clampedT = Math.max(0, Math.min(T, t));
  return pm.height - (M / 2) * (1 - Math.cos((Math.PI * clampedT) / T));
}

export function getInterpolatedHeight(
  events: TideEvent[],
  targetTime: Date
): number {
  if (events.length < 2) return 0;
  for (let i = 0; i < events.length - 1; i++) {
    const start = events[i];
    const end = events[i + 1];
    if (
      targetTime.getTime() >= start.time.getTime() &&
      targetTime.getTime() <= end.time.getTime()
    ) {
      if (start.type === 'BM' && end.type === 'PM') {
        return interpolateHeight(start, end, targetTime);
      } else if (start.type === 'PM' && end.type === 'BM') {
        return interpolateHeightDesc(start, end, targetTime);
      }
    }
  }
  if (targetTime.getTime() < events[0].time.getTime()) {
    return events[0].height;
  }
  return events[events.length - 1].height;
}

// ============================================================
// Interpolation linéaire sur la courbe (précis avec le pas de 5 min SHOM)
// ============================================================

function getCurveHeight(curve: HourlyTideData[], targetTime: Date): number | null {
  const t = targetTime.getTime();
  if (curve.length < 2) return null;
  if (t < curve[0].time.getTime() || t > curve[curve.length - 1].time.getTime()) {
    return null;
  }
  // Recherche dichotomique du segment encadrant
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
  const frac = (t - a.time.getTime()) / span;
  return a.height + (b.height - a.height) * frac;
}

/** Instant où la courbe croise `target` entre deux points (interp. linéaire) */
function crossingTime(
  a: HourlyTideData,
  b: HourlyTideData,
  target: number
): Date {
  const span = b.height - a.height;
  const frac = span !== 0 ? (target - a.height) / span : 0;
  return new Date(
    a.time.getTime() + frac * (b.time.getTime() - a.time.getTime())
  );
}

/** Premier croisement descendant de `target` après `from` */
function findDescendingCrossing(
  curve: HourlyTideData[],
  from: Date,
  target: number
): Date | null {
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].time.getTime() <= from.getTime()) continue;
    const a = curve[i - 1];
    const b = curve[i];
    if (a.height >= target && b.height < target) {
      return crossingTime(a, b, target);
    }
  }
  return null;
}

// ============================================================
// Recherche de croisement sinusoïdal (conservé pour compatibilité)
// ============================================================

export function findCrossingHeight(
  bm: TideEvent,
  pm: TideEvent,
  targetHeight: number
): Date | null {
  const minH = Math.min(bm.height, pm.height);
  const maxH = Math.max(bm.height, pm.height);
  if (targetHeight < minH || targetHeight > maxH) return null;

  let low = bm.time.getTime();
  let high = pm.time.getTime();
  for (let iter = 0; iter < 50; iter++) {
    const mid = (low + high) / 2;
    const h = interpolateHeight(bm, pm, new Date(mid));
    if (Math.abs(h - targetHeight) < 0.001) return new Date(mid);
    if (h < targetHeight) low = mid;
    else high = mid;
  }
  return new Date((low + high) / 2);
}

// ============================================================
// Calcul des fenêtres d'ouverture (règles de l'automate)
// ============================================================

/**
 * Fenêtres d'ouverture calculées sur la courbe de hauteur d'eau.
 *
 * - Ouverture : croisement montant de 7.33 m.
 * - Fermeture, selon la PM du cycle et son coefficient :
 *   - PM ≤ 7.6 m            → fermeture à la PM (pas de seuil descendant) ;
 *   - PM > 7.6 m, coef < 70 → croisement descendant de 7.60 m ;
 *   - PM > 7.6 m, coef ≥ 70 → croisement descendant de 8.00 m,
 *                              ou à la PM si celle-ci reste sous 8.00 m.
 */
function calculateWindowsFromCurve(
  curve: HourlyTideData[],
  events: TideEvent[]
): TideWindow[] {
  const windows: TideWindow[] = [];
  let lastClose = -Infinity;

  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if (!(a.height < GATE_OPEN_HEIGHT && b.height >= GATE_OPEN_HEIGHT)) continue;

    const openTime = crossingTime(a, b, GATE_OPEN_HEIGHT);
    if (openTime.getTime() <= lastClose) continue;

    // PM du cycle = premier événement PM après l'ouverture
    const pm = events.find(
      (e) => e.type === 'PM' && e.time.getTime() >= openTime.getTime()
    );
    if (!pm) continue; // bord de l'intervalle de données : cycle incomplet

    // Coefficient du cycle : officiel SHOM si présent, sinon approximation
    let coef = pm.coefficient;
    if (coef === undefined) {
      const bmAround = events.find(
        (e) => e.type === 'BM' && Math.abs(e.time.getTime() - pm.time.getTime()) < 9 * 3600 * 1000
      );
      coef = bmAround
        ? Math.round(calculateCoefficient(pm.height, bmAround.height))
        : COEF_THRESHOLD;
    }

    let closeTime: Date | null;
    if (pm.height <= GATE_CLOSE_LOW) {
      closeTime = pm.time;
    } else if (coef < COEF_THRESHOLD) {
      closeTime = findDescendingCrossing(curve, pm.time, GATE_CLOSE_LOW);
    } else if (pm.height > GATE_CLOSE_HIGH) {
      closeTime = findDescendingCrossing(curve, pm.time, GATE_CLOSE_HIGH);
    } else {
      closeTime = pm.time;
    }
    if (!closeTime) closeTime = pm.time;

    if (closeTime.getTime() > openTime.getTime()) {
      windows.push({
        openTime,
        closeTime,
        durationMinutes: (closeTime.getTime() - openTime.getTime()) / 60000,
      });
      lastClose = closeTime.getTime();
    }
  }

  return windows;
}

/**
 * Version historique basée sur les événements PM/BM et l'interpolation
 * sinusoïdale. Conservée pour compatibilité ; le pipeline principal passe
 * par la courbe SHOM (calculateWindowsFromCurve).
 */
export function calculateWindows(events: TideEvent[]): TideWindow[] {
  if (events.length < 2) return [];
  const curve: HourlyTideData[] = [];
  const start = events[0].time.getTime();
  const end = events[events.length - 1].time.getTime();
  for (let t = start; t <= end; t += 5 * 60 * 1000) {
    const time = new Date(t);
    curve.push({ time, height: getInterpolatedHeight(events, time) });
  }
  return calculateWindowsFromCurve(curve, events);
}

// ============================================================
// Fonction principale
// ============================================================

export async function getTideDataForDate(
  date: Date,
  pressureCorrection: number
): Promise<TideData> {
  // 1. Source de données : SHOM → Open-Meteo calibré → mock
  let source: TideSource = 'shom';
  let range = await getShomRange(date);
  if (!range) {
    source = 'openmeteo';
    range = await getOpenMeteoRange(date);
  }
  if (!range) {
    source = 'mock';
    range = getMockRange(date);
  }

  // 2. Correction barométrique : décalage uniforme des hauteurs
  const correction = pressureCorrection || 0;
  const events = range.events.map((e) => ({ ...e, height: e.height + correction }));
  const curve = range.curve.map((p) => ({ ...p, height: p.height + correction }));

  // 3. Fenêtres d'ouverture sur l'ensemble de l'intervalle (j-1 → j+1)
  const allWindows = calculateWindowsFromCurve(curve, events);

  // 4. Restriction au jour demandé (jour calendaire local)
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

  const dayEvents = events.filter((e) => isSameLocalDay(e.time, date));
  const dayWindows = allWindows.filter(
    (w) => w.closeTime.getTime() > dayStart.getTime() && w.openTime.getTime() < dayEnd.getTime()
  );
  const dayCurve = curve.filter(
    (p) => p.time.getTime() >= dayStart.getTime() && p.time.getTime() < dayEnd.getTime()
  );

  // 5. Coefficient du jour : officiel SHOM si disponible
  const pmEvents = dayEvents.filter((e) => e.type === 'PM');
  const bmEvents = dayEvents.filter((e) => e.type === 'BM');
  let coefficient = pmEvents.find((e) => e.coefficient !== undefined)?.coefficient;
  if (coefficient === undefined) {
    coefficient =
      pmEvents.length > 0 && bmEvents.length > 0
        ? Math.round(calculateCoefficient(pmEvents[0].height, bmEvents[0].height))
        : COEF_THRESHOLD;
  }

  // 6. Pression (météo réelle, indicative — la correction appliquée reste
  // celle passée en paramètre, contrôlée par l'utilisateur)
  const pressureData = await fetchPressure(date);
  const now = new Date();
  const refTime = isSameLocalDay(now, date) ? now : new Date(dayStart.getTime() + 12 * 3600 * 1000);
  const nearest = pressureData.reduce((best, p) =>
    Math.abs(p.time.getTime() - refTime.getTime()) <
    Math.abs(best.time.getTime() - refTime.getTime())
      ? p
      : best
  );

  // 7. État courant
  const currentHeight =
    getCurveHeight(curve, now) ?? getInterpolatedHeight(events, now);
  const nowMs = now.getTime();
  const isOpen = allWindows.some(
    (w) => nowMs >= w.openTime.getTime() && nowMs <= w.closeTime.getTime()
  );

  let nextEvent: { type: 'open' | 'close'; time: Date } | null = null;
  for (const w of allWindows) {
    if (w.openTime.getTime() > nowMs) {
      if (!nextEvent || w.openTime.getTime() < nextEvent.time.getTime()) {
        nextEvent = { type: 'open', time: w.openTime };
      }
    }
    if (w.closeTime.getTime() > nowMs && w.openTime.getTime() <= nowMs) {
      if (!nextEvent || w.closeTime.getTime() < nextEvent.time.getTime()) {
        nextEvent = { type: 'close', time: w.closeTime };
      }
    }
  }

  return {
    events: dayEvents,
    windows: dayWindows,
    coefficient: Math.round(coefficient),
    currentHeight,
    isOpen,
    nextEvent,
    pressure: Math.round(nearest.pressure),
    pressureCorrection: correction,
    source,
    curve: dayCurve,
  };
}

/**
 * Données pour plusieurs jours consécutifs (page Prévisions).
 * Pré-charge l'intervalle SHOM en une seule requête puis calcule jour par jour.
 */
export async function getTideDataForDates(
  start: Date,
  count: number,
  pressureCorrection: number
): Promise<TideData[]> {
  // Pré-remplissage du cache : [start - 1, start + count] en un seul appel
  await ensureShomDays(addDays(start, -1), count + 2);

  const results: TideData[] = [];
  for (let i = 0; i < count; i++) {
    results.push(await getTideDataForDate(addDays(start, i), pressureCorrection));
  }
  return results;
}

// ============================================================
// Helpers pour les composants
// ============================================================

export function getNextTideEvent(events: TideEvent[]): TideEvent | null {
  const now = Date.now();
  for (const e of events) {
    if (e.time.getTime() > now) return e;
  }
  return events[events.length - 1] ?? null;
}

export function getPressureCorrection(pressure: number): number {
  return -((pressure - 1013.25) * 0.01);
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}
