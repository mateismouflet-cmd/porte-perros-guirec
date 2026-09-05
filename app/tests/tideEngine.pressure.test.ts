import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fetchPressureRange, getPressureAt, getTideDataForDate, getTideDataForDates } from '../src/lib/tideEngine.ts';

const hlt = JSON.parse(fs.readFileSync(new URL('./fixtures/shom-2026-09-04-hlt.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const wl = JSON.parse(fs.readFileSync(new URL('./fixtures/shom-2026-09-04-wl.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const target = new Date(2026, 8, 5, 12);

function setup(pressure: (time: Date) => number | null = () => 1026.7) {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  // Données SHOM publiques récupérées le 5 septembre 2026, trois jours complets.
  for (const day of Object.keys(hlt)) {
    values.set(`shom-day-v2-${day}`, JSON.stringify({ timestamp: Date.now(), data: { hlt: hlt[day], wl: wl[day] } }));
  }
  // Les jours supplémentaires servent uniquement à couvrir les bords de la semaine.
  for (const day of [3, ...Array.from({ length: 10 }, (_, i) => i + 7)]) {
    values.set(`shom-day-v2-2026-09-${day.toString().padStart(2, '0')}`, JSON.stringify({ timestamp: Date.now(), data: { hlt: hlt['2026-09-06'], wl: wl['2026-09-06'] } }));
  }
  const requests: URL[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    requests.push(url);
    assert.equal(url.hostname, 'api.open-meteo.com');
    assert.equal(url.searchParams.get('hourly'), 'pressure_msl');
    assert.equal(url.searchParams.get('timeformat'), 'unixtime');
    const start = new Date(`${url.searchParams.get('start_date')}T00:00:00`);
    const end = new Date(`${url.searchParams.get('end_date')}T23:00:00`);
    const time = [], pressure_msl = [];
    for (let ms = start.getTime(); ms <= end.getTime(); ms += 3600000) {
      time.push(ms / 1000);
      pressure_msl.push(pressure(new Date(ms)));
    }
    return Response.json({ hourly: { time, pressure_msl } });
  };
  return { requests, values };
}

test('le 5 septembre : le créneau de 46 minutes disparaît avec la pression horaire', async () => {
  setup();
  const uncorrected = await getTideDataForDate(target, 0);
  const corrected = await getTideDataForDate(target);
  const midday = (w: { openTime: Date }) => w.openTime.getDate() === 5 && w.openTime.getHours() >= 6;
  assert.equal(uncorrected.windows.filter(midday)[0].durationMinutes, 46);
  assert.equal(corrected.windows.filter(midday).length, 0);
  assert.equal(corrected.pressureStatus, 'applied');
  assert.ok(Math.abs(corrected.events.find(e => e.type === 'PM' && e.time.getHours() === 12)!.height - 7.2855) < 1e-8);
  assert.deepEqual(corrected.events.map(e => e.coefficient), uncorrected.events.map(e => e.coefficient));
});

test('chaque heure et chaque jour utilisent leur propre pression ; les pages concordent', async () => {
  const { requests } = setup(time => 1013.25 + (time.getDate() - 5) * 5 + time.getHours() / 2);
  const week = await getTideDataForDates(new Date(2026, 8, 5), 7);
  assert.equal(requests.length, 1, 'une seule requête météo pour toute la semaine');
  for (let day = 0; day < 2; day++) {
    const raw = await getTideDataForDate(new Date(2026, 8, 5 + day), 0);
    for (const hour of [2, 12, 20]) {
      const point = week[day].curve.find(p => p.time.getHours() === hour && p.time.getMinutes() === 0)!;
      const baseline = raw.curve.find(p => p.time.getTime() === point.time.getTime())!;
      assert.ok(Math.abs(point.height - baseline.height + (day * 5 + hour / 2) * 0.01) < 1e-8);
    }
  }
  const today = await getTideDataForDate(target, 'auto', 10);
  assert.deepEqual(today.windows, week[0].windows);
  assert.deepEqual(today.curve, week[0].curve);
});

test('interpolation continue à minuit, sans prolonger ni combler les trous météo', () => {
  const points = [
    { time: new Date(2026, 8, 5, 23), pressure: 1010 },
    { time: new Date(2026, 8, 6, 0), pressure: 1020 },
    { time: new Date(2026, 8, 6, 2), pressure: 1030 },
  ];
  assert.equal(getPressureAt(points, new Date(2026, 8, 5, 23, 30)), 1015);
  assert.equal(getPressureAt(points, new Date(2026, 8, 6, 0)), 1020);
  assert.equal(getPressureAt(points, new Date(2026, 8, 6, 1)), null);
  assert.equal(getPressureAt(points, new Date(2026, 8, 5, 22)), null);
  assert.equal(getPressureAt(points, new Date(2026, 8, 6, 3)), null);
});

test('la fenêtre à cheval sur minuit est identique sur les deux jours', async () => {
  setup(time => 1013.25 + (time.getDate() - 4) * 2 + time.getHours() / 12);
  const previous = await getTideDataForDate(new Date(2026, 8, 4), 'auto', 2);
  const today = await getTideDataForDate(target);
  assert.deepEqual(previous.windows.find(w => w.closeTime.getDate() === 5), today.windows.find(w => w.openTime.getDate() === 4));
});

test('désactivation et simulation restent distinctes du suivi automatique', async () => {
  setup();
  const off = await getTideDataForDate(target, 0);
  const manual = await getTideDataForDate(target, 0.2);
  assert.equal(off.pressureStatus, 'disabled');
  assert.equal(manual.pressureStatus, 'simulation');
  for (let i = 0; i < off.curve.length; i++) assert.ok(Math.abs(manual.curve[i].height - off.curve[i].height - 0.2) < 1e-8);
});

test('météo en panne : aucune pression fictive et horaires explicitement non corrigés', async () => {
  setup();
  globalThis.fetch = async () => { throw new Error('hors ligne'); };
  const data = await getTideDataForDate(target);
  const off = await getTideDataForDate(target, 0);
  assert.equal(data.pressure, null);
  assert.equal(data.pressureUpdatedAt, null);
  assert.equal(data.pressureStatus, 'unavailable');
  assert.deepEqual(data.windows, off.windows);
  assert.deepEqual(data.curve, off.curve);
});

test('une heure null laisse le cycle entier sans correction et signale la couverture partielle', async () => {
  setup(time => time.getDate() === 5 && time.getHours() === 12 ? null : 1026.7);
  const partial = await getTideDataForDate(target);
  const off = await getTideDataForDate(target, 0);
  assert.equal(partial.pressureStatus, 'partial');
  assert.deepEqual(partial.windows.find(w => w.openTime.getHours() === 12), off.windows.find(w => w.openTime.getHours() === 12));
});

test('cache météo : lecture conserve la date ; renouvellement après 30 minutes', async t => {
  let pressure = 1026.7;
  const { requests } = setup(() => pressure);
  const now = Date.now();
  const clock = t.mock.method(Date, 'now', () => now);
  const first = await fetchPressureRange(target, target);
  clock.mock.mockImplementation(() => now + 29 * 60000);
  const cached = await fetchPressureRange(target, target);
  assert.equal(requests.length, 1);
  assert.deepEqual(cached.fetchedAt, first.fetchedAt);
  pressure = 1010;
  clock.mock.mockImplementation(() => now + 31 * 60000);
  const renewed = await fetchPressureRange(target, target);
  assert.equal(requests.length, 2);
  assert.equal(renewed.fetchedAt!.getTime(), now + 31 * 60000);
  assert.equal(renewed.points[0].pressure, 1010);
  clock.mock.mockImplementation(() => now + 62 * 60000);
  globalThis.fetch = async () => { throw new Error('météo inaccessible'); };
  const unavailable = await fetchPressureRange(target, target);
  assert.equal(unavailable.fetchedAt, null);
  assert.deepEqual(unavailable.points, []);
});

test('le repli marin inclut déjà la pression : aucune double correction ni simulation ajoutée', async () => {
  const { values } = setup();
  values.clear();
  const weatherFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.startsWith('/api/shom')) return new Response('', { status: 503 });
    if (url.includes('marine-api.open-meteo.com')) {
      const time = [], sea_level_height_msl = [];
      for (let hour = 0; hour < 72; hour++) {
        const date = new Date(2026, 8, 4, hour);
        const key = `${date.getFullYear()}-09-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`;
        time.push(key);
        sea_level_height_msl.push(2 * Math.cos(hour * Math.PI / 6));
      }
      return Response.json({ hourly: { time, sea_level_height_msl } });
    }
    return weatherFetch(input);
  };
  const auto = await getTideDataForDate(target);
  const off = await getTideDataForDate(target, 0);
  const manual = await getTideDataForDate(target, 0.2);
  assert.equal(auto.source, 'openmeteo');
  assert.equal(auto.pressureStatus, 'included');
  assert.deepEqual(auto.curve, off.curve);
  assert.deepEqual(auto.curve, manual.curve);
  assert.equal(auto.pressureCorrection, 0);
});
