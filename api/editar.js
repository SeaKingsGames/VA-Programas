// Todo lo que cambia datos pasa por aquí. Revisa la contraseña guardada en
// la variable CLAVE_EDITORES de Vercel y escribe en Supabase con la clave secreta.
// Variables necesarias en Vercel:
//   CLAVE_EDITORES              la contraseña de los editores
//   SUPABASE_URL                https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   clave secreta (service_role o sb_secret_…). Nunca va en index.html
//   SUPABASE_BUCKET             opcional, por defecto "fotos"
const crypto = require('crypto');

const COLECCIONES = new Set(['personas', 'formatos', 'programas', 'ajustes']);
const DIAS_SESION = 30;
const esperar = ms => new Promise(r => setTimeout(r, ms));
const hash = v => crypto.createHash('sha256').update(String(v)).digest();
const mismaClave = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));
const firma = (exp, clave) => crypto.createHmac('sha256', 'programas-editores:' + clave).update(String(exp)).digest('base64url');

function crearToken(clave) {
  const exp = Date.now() + DIAS_SESION * 864e5;
  return exp + '.' + firma(exp, clave);
}
// Al cambiar la contraseña en Vercel, todos los tokens anteriores dejan de servir.
function tokenValido(token, clave) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(sig), b = Buffer.from(firma(exp, clave));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function limpiarFilas(filas) {
  if (!Array.isArray(filas) || !filas.length || filas.length > 2000) throw Object.assign(new Error('Datos no válidos'), { status: 400 });
  return filas.map(f => {
    if (!f || typeof f.id !== 'string' || !f.id || f.id.length > 120 || !COLECCIONES.has(f.coleccion) || !f.data || typeof f.data !== 'object' || Array.isArray(f.data)) {
      throw Object.assign(new Error('Hay un registro con datos no válidos'), { status: 400 });
    }
    return { id: f.id, coleccion: f.coleccion, data: f.data, publicado: f.coleccion !== 'programas' || f.data.publicado === true, updated_at: new Date().toISOString() };
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST' });

  const CLAVE = process.env.CLAVE_EDITORES || '';
  const URL_SB = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const BUCKET = process.env.SUPABASE_BUCKET || 'fotos';
  if (!CLAVE || !URL_SB || !KEY) return res.status(500).json({ error: 'Faltan variables en Vercel: CLAVE_EDITORES, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.' });

  const sb = async (ruta, opt = {}) => {
    const auth = /^eyJ/.test(KEY) ? { Authorization: 'Bearer ' + KEY } : {};
    const r = await fetch(URL_SB + ruta, { ...opt, headers: { apikey: KEY, ...auth, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
    if (!r.ok) throw Object.assign(new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200)), { status: 502 });
    return r;
  };

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  try {
    if (body.accion === 'entrar') {
      if (!mismaClave(body.clave || '', CLAVE)) { await esperar(1200); return res.status(401).json({ error: 'Contraseña incorrecta' }); }
      return res.status(200).json({ token: crearToken(CLAVE) });
    }

    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!tokenValido(token, CLAVE)) return res.status(401).json({ error: 'Sesión vencida. Entra de nuevo.' });

    switch (body.accion) {
      case 'leer': {
        const r = await sb('/rest/v1/registros?select=id,coleccion,data', { method: 'GET' });
        return res.status(200).json({ filas: await r.json() });
      }
      case 'guardar': {
        await sb('/rest/v1/registros', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(limpiarFilas(body.filas)) });
        return res.status(200).json({ ok: true });
      }
      case 'borrar': {
        const ids = (Array.isArray(body.ids) ? body.ids : []).filter(id => typeof id === 'string' && id && id.length <= 120).slice(0, 500);
        for (const id of ids) await sb('/rest/v1/registros?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
        return res.status(200).json({ ok: true });
      }
      case 'borrar-todo': {
        await sb('/rest/v1/registros?id=neq.__ninguno__', { method: 'DELETE' });
        return res.status(200).json({ ok: true });
      }
      case 'subir-foto': {
        const tipo = body.tipo === 'image/png' ? 'image/png' : 'image/jpeg';
        const buf = Buffer.from(String(body.base64 || ''), 'base64');
        if (!buf.length || buf.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Imagen no válida o muy grande' });
        const nombre = crypto.randomBytes(10).toString('hex') + (tipo === 'image/png' ? '.png' : '.jpg');
        await sb(`/storage/v1/object/${BUCKET}/${nombre}`, { method: 'POST', headers: { 'Content-Type': tipo, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }, body: buf });
        return res.status(200).json({ url: `${URL_SB}/storage/v1/object/public/${BUCKET}/${nombre}` });
      }
      default:
        return res.status(400).json({ error: 'Acción desconocida' });
    }
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || 'Error del servidor' });
  }
};
