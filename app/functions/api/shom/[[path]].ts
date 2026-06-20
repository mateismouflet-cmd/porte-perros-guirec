// app/functions/api/shom/[[path]].ts
//
// Pages Function catch-all : proxifie /api/shom/* vers l'API SHOM (hdm) en
// injectant le Referer maree.shom.fr + un User-Agent navigateur, SANS Origin.
// Équivalent prod du proxy Vite de vite.config.ts. Le front (tideEngine.ts)
// appelle fetch('/api/shom/spm/hlt?...') et fetch('/api/shom/spm/wl?...') —
// mêmes URLs qu'en dev, rien à changer côté app.

// Préfixe upstream : clé PUBLIQUE embarquée dans maree.shom.fr (champ
// hdmServiceUrl). Si le SHOM la tourne, mettre à jour ICI ET dans vite.config.ts.
const SHOM_HDM = 'https://services.data.shom.fr/b2q8lrcdl4s04cbabsj4nhcb/hdm';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Le front ne fait que des GET ; même origine donc aucun préflight CORS.
export const onRequestGet: PagesFunction = async (context) => {
  const { params, request } = context;

  // params.path = tableau de segments pour un catch-all [[path]]
  // (/api/shom/spm/hlt -> ["spm","hlt"]). Le préfixe /api/shom est déjà strippé
  // par le routing file-based -> pas de double préfixe.
  const raw = params.path;
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const subPath = segments
    .filter((s) => s && s !== '.' && s !== '..')
    .map((s) => encodeURIComponent(s))
    .join('/');

  // Query string déjà préfixé de "?" (ou "") -> transmis intact.
  const search = new URL(request.url).search;
  const target = `${SHOM_HDM}/${subPath}${search}`;

  // Objet headers NEUF : on ne clone jamais la Request entrante (sinon on
  // propagerait l'Origin/les cookies du navigateur client = domaine pages.dev,
  // -> 403 du WAF SHOM).
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: 'GET',
      headers: {
        Referer: 'https://maree.shom.fr/',
        'User-Agent': BROWSER_UA,
        Accept: 'application/json, text/plain, */*',
      },
      // redirect: 'follow' (défaut) : si le SHOM renvoie un 30x, Cloudflare le
      // suit côté serveur en réémettant nos headers.
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Upstream SHOM injoignable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Headers de réponse reconstruits : NE PAS recopier upstream.headers en bloc
  // (Cloudflare a déjà décompressé le corps -> un Content-Encoding/Length hérité
  // serait faux et corromprait le JSON).
  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'application/json');
  // Ne mettre en cache que les réponses OK : sinon un 403/erreur transitoire du
  // SHOM serait figé 24 h au bord (cache poisoning). Les prédictions OK sont
  // déterministes -> cache long.
  headers.set(
    'Cache-Control',
    upstream.ok ? 'public, max-age=86400' : 'no-store',
  );

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};
