// app/functions/api/visites.ts
//
// Compteur de connexions. GET = lire le total, POST = incrémenter et lire.
// Binding KV "COMPTEUR" à configurer dans le dashboard Cloudflare Pages
// (Workers & Pages -> projet -> Settings -> Bindings -> KV namespace).
// Sans binding -> 503, le front n'affiche simplement rien.
//
// KV n'est pas atomique (read-modify-write) : deux visites strictement
// simultanées peuvent perdre un incrément. Acceptable à cette échelle.

type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};
type Env = { COMPTEUR?: KV };

const CLE = 'total';

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

async function lire(kv: KV): Promise<number> {
  const brut = await kv.get(CLE);
  const n = brut ? parseInt(brut, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.COMPTEUR) return json({ error: 'KV non configuré' }, 503);
  return json({ visites: await lire(env.COMPTEUR) });
};

export const onRequestPost: PagesFunction<Env> = async ({ env }) => {
  if (!env.COMPTEUR) return json({ error: 'KV non configuré' }, 503);
  const total = (await lire(env.COMPTEUR)) + 1;
  await env.COMPTEUR.put(CLE, String(total));
  return json({ visites: total });
};
