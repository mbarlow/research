// Hash-based SPA router
// Routes: #/ (home), #/post/<slug>, #/tag/<tag>, #/tags

const routes = [];
let currentRoute = null;

export function addRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

export function navigate(hash) {
  window.location.hash = hash;
}

export function getCurrentRoute() {
  return currentRoute;
}

function matchRoute(hash) {
  const path = hash.replace(/^#/, '') || '/';
  for (const route of routes) {
    if (typeof route.pattern === 'string') {
      if (route.pattern === path) return { handler: route.handler, params: {} };
    } else {
      const match = path.match(route.pattern);
      if (match) return { handler: route.handler, params: match.groups || {} };
    }
  }
  return null;
}

function handleRoute() {
  const hash = window.location.hash || '#/';
  const match = matchRoute(hash);
  if (match) {
    currentRoute = { hash, ...match };
    match.handler(match.params);
  }
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
