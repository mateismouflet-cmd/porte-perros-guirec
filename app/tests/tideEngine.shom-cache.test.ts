import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureShomDays } from '../src/lib/tideEngine.ts';

interface CacheEntry {
  timestamp: number;
  data: unknown;
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function addUtcDays(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function rawDay(dayKey: string) {
  return {
    hlt: [
      ['PM', '06:00', '8.10', '75'],
      ['BM', '12:00', '2.10', ''],
    ],
    wl: [
      ['00:00:00', 5.1],
      ['06:00:00', 8.1],
    ],
    dayKey,
  };
}

function cacheDay(storage: Storage, dayKey: string): void {
  const raw = rawDay(dayKey);
  const entry: CacheEntry = {
    timestamp: Date.now(),
    data: { hlt: raw.hlt, wl: raw.wl },
  };
  storage.setItem(`shom-day-v2-${dayKey}`, JSON.stringify(entry));
}

function installShomFetchMock(requests: URL[]): void {
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = new URL(String(input), 'http://localhost');
    requests.push(url);

    const startKey = url.searchParams.get('date');
    const duration = Number(url.searchParams.get('duration'));
    assert.ok(startKey);
    assert.ok(duration >= 2 && duration <= 7);

    const body: Record<string, unknown> = {};
    for (let i = 0; i < duration; i++) {
      const dayKey = addUtcDays(startKey, i);
      const raw = rawDay(dayKey);
      body[dayKey] = url.pathname.endsWith('/hlt') ? raw.hlt : raw.wl;
    }
    return Response.json(body);
  };
}

test('un cache vide récupère sept jours via les deux flux SHOM', async () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const requests: URL[] = [];
  installShomFetchMock(requests);

  const available = await ensureShomDays(new Date('2026-09-01T12:00:00'), 7);

  assert.equal(available, true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map((url) => url.pathname).sort(), [
    '/api/shom/spm/hlt',
    '/api/shom/spm/wl',
  ]);
  for (const request of requests) {
    assert.equal(request.searchParams.get('date'), '2026-09-01');
    assert.equal(request.searchParams.get('duration'), '7');
  }
  for (let i = 0; i < 7; i++) {
    assert.ok(storage.getItem(`shom-day-v2-${addUtcDays('2026-09-01', i)}`));
  }
});

test('le dernier jour manquant est demandé avec le jour précédent', async () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  for (let i = 0; i < 6; i++) cacheDay(storage, addUtcDays('2026-09-01', i));
  const requests: URL[] = [];
  installShomFetchMock(requests);

  const available = await ensureShomDays(new Date('2026-09-01T12:00:00'), 7);

  assert.equal(available, true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map((url) => url.pathname).sort(), [
    '/api/shom/spm/hlt',
    '/api/shom/spm/wl',
  ]);
  for (const request of requests) {
    assert.equal(request.searchParams.get('date'), '2026-09-06');
    assert.equal(request.searchParams.get('duration'), '2');
  }

  const cached = storage.getItem('shom-day-v2-2026-09-07');
  assert.ok(cached);
  const parsed = JSON.parse(cached) as CacheEntry;
  assert.deepEqual(parsed.data, {
    hlt: rawDay('2026-09-07').hlt,
    wl: rawDay('2026-09-07').wl,
  });
});
