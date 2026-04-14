// Read the build SHA from <meta name="site-version"> and expose helpers
// for cache-busting runtime asset URLs.

let cached = null;

export function getVersion() {
  if (cached !== null) return cached;
  const meta = document.querySelector('meta[name="site-version"]');
  cached = (meta && meta.content) ? meta.content : '';
  return cached;
}

// Append ?v=<sha> to a local URL. No-ops when version is empty (dev) or the
// URL already has a query string (leave alone) or is absolute to another
// origin.
export function bust(url) {
  if (!url) return url;
  const v = getVersion();
  if (!v) return url;
  if (/^(https?:)?\/\//.test(url)) return url; // don't bust external
  if (/^data:/.test(url)) return url;
  if (url.includes('?')) return url; // don't clobber existing query
  return `${url}?v=${v}`;
}
