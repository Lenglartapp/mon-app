// Connecteur Odoo (JSON-RPC) — tourne UNIQUEMENT côté serveur (Vercel Functions).
// La clé API vit dans les variables d'environnement, jamais dans le navigateur.
//
// Variables attendues :
//   ODOO_URL    ex. https://lenglart-erp-lenglart.odoo.com
//   ODOO_DB     ex. lenglart-erp-lenglart-main-9543240   (nom du build Odoo.sh)
//   ODOO_LOGIN  ex. aristide.lenglart@lenglart.com
//   ODOO_KEY    clé API Odoo

const CFG = () => ({
  url: process.env.ODOO_URL,
  db: process.env.ODOO_DB,
  login: process.env.ODOO_LOGIN,
  key: process.env.ODOO_KEY,
});

function assertConfig(c) {
  const missing = ['url', 'db', 'login', 'key'].filter((k) => !c[k]);
  if (missing.length) {
    throw new Error(
      `Configuration Odoo incomplète : ${missing
        .map((k) => 'ODOO_' + k.toUpperCase())
        .join(', ')} manquant(e).`
    );
  }
}

async function jsonRpc(service, method, args) {
  const c = CFG();
  assertConfig(c);
  const res = await fetch(`${c.url}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: { service, method, args },
    }),
  });
  if (!res.ok) {
    throw new Error(`Odoo HTTP ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (data.error) {
    const msg =
      data.error.data?.message || data.error.message || 'Erreur Odoo inconnue';
    const err = new Error(msg);
    err.odoo = data.error;
    throw err;
  }
  return data.result;
}

let _uidCache = null;

/** Authentifie et renvoie l'uid Odoo (mis en cache pour l'invocation). */
export async function authenticate() {
  if (_uidCache) return _uidCache;
  const c = CFG();
  assertConfig(c);
  const uid = await jsonRpc('common', 'authenticate', [c.db, c.login, c.key, {}]);
  if (!uid) {
    throw new Error(
      'Authentification Odoo refusée (clé API ou identifiants invalides, ou mauvaise base).'
    );
  }
  _uidCache = uid;
  return uid;
}

/** Renvoie { server_version, ... } — utile pour un test de connexion sans auth. */
export async function version() {
  return jsonRpc('common', 'version', []);
}

/** Appelle une méthode d'un modèle Odoo (execute_kw). */
export async function execute(model, method, args = [], kwargs = {}) {
  const c = CFG();
  const uid = await authenticate();
  return jsonRpc('object', 'execute_kw', [
    c.db,
    uid,
    c.key,
    model,
    method,
    args,
    kwargs,
  ]);
}

/** Raccourci search_read typé. */
export function searchRead(model, domain = [], fields = [], opts = {}) {
  return execute(model, 'search_read', [domain], { fields, ...opts });
}
