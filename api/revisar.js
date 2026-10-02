// Página de revisión: abre  https://TU-APP.vercel.app/api/revisar
// Revisa las variables de Vercel y la conexión con Supabase, y dice qué corregir.
// Nunca muestra contraseñas ni claves, solo si están bien o mal.
const limpiarUrl = v => String(v || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '').replace(/\/+$/, '');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function leerJwt(k) {
  try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString('utf8')); } catch (e) { return null; }
}
function tipoClave(k) {
  if (!k) return { tipo: 'falta' };
  if (k.startsWith('sb_publishable_')) return { tipo: 'publica' };
  if (k.startsWith('sb_secret_')) return { tipo: 'secreta' };
  if (/^eyJ/.test(k)) {
    const p = leerJwt(k);
    if (p && p.role === 'anon') return { tipo: 'publica', ref: p.ref };
    if (p && p.role === 'service_role') return { tipo: 'secreta', ref: p.ref };
  }
  return { tipo: 'desconocida' };
}
async function explicar(r) {
  let j = {}; let t = '';
  try { t = await r.text(); j = JSON.parse(t); } catch (e) { }
  const msg = String(j.message || j.error || j.msg || t || '').slice(0, 200);
  const code = String(j.code || '');
  if (r.status === 401 || /invalid api key|no api key|unauthorized/i.test(msg)) return 'La clave no sirve para este proyecto. Cópiala otra vez desde Project Settings > API Keys (sin espacios) y haz Redeploy.';
  if (code === 'PGRST205' || code === '42P01' || /could not find the table|does not exist/i.test(msg)) return 'No existe la tabla "registros". Corre el archivo supabase.sql completo en SQL Editor.';
  if (code === '42501' || /permission denied/i.test(msg)) return 'Falta permiso para leer la tabla. Corre otra vez supabase.sql completo.';
  if (code === 'PGRST106' || /schema must be one of/i.test(msg)) return 'El proyecto no está publicando el esquema "public". En Project Settings > Data API, en Exposed schemas agrega public y guarda.';
  if (r.status === 404) return 'No se encontró la API. Revisa que SUPABASE_URL sea la Project URL y que la Data API esté activada (Project Settings > Data API).';
  if (r.status >= 500) return 'Supabase no respondió bien. Si el proyecto está pausado, entra al panel de Supabase y toca Restore.';
  return `Supabase respondió ${r.status}${msg ? ': ' + msg : ''}`;
}

module.exports = async (req, res) => {
  const URL_SB = limpiarUrl(process.env.SUPABASE_URL);
  const PUB = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const SEC = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const CLAVE = String(process.env.CLAVE_EDITORES || '').trim();
  const BUCKET = String(process.env.SUPABASE_BUCKET || 'fotos').trim();
  const filas = [];
  const add = (estado, titulo, detalle) => filas.push({ estado, titulo, detalle });

  // 1) Variables
  add(CLAVE ? (CLAVE.length < 10 ? 'aviso' : 'ok') : 'mal', 'CLAVE_EDITORES',
    !CLAVE ? 'Falta. Agrégala en Vercel > Settings > Environment Variables y haz Redeploy.' : CLAVE.length < 10 ? 'Configurada, pero es corta. Usa al menos 10 caracteres.' : 'Configurada.');

  let host = '';
  try { host = new URL(URL_SB).hostname; } catch (e) { }
  const refUrl = host.endsWith('.supabase.co') ? host.split('.')[0] : '';
  if (!URL_SB) add('mal', 'SUPABASE_URL', 'Falta. Es la Project URL, se ve como https://abcdefgh.supabase.co');
  else if (!/^https:\/\//.test(URL_SB) || !host) add('mal', 'SUPABASE_URL', `Debe empezar con https:// y verse como https://abcdefgh.supabase.co. Ahora dice: ${URL_SB}`);
  else if (host.includes('supabase.com')) add('mal', 'SUPABASE_URL', 'Esa es la dirección del panel de Supabase, no la del proyecto. Usa la Project URL (botón Connect o Project Settings > Data API): https://abcdefgh.supabase.co');
  else if (!refUrl) add('aviso', 'SUPABASE_URL', `No termina en .supabase.co (${URL_SB}). Si no usas un dominio propio, revísala.`);
  else add('ok', 'SUPABASE_URL', URL_SB);

  const pub = tipoClave(PUB), sec = tipoClave(SEC);
  if (pub.tipo === 'falta') add('mal', 'SUPABASE_ANON_KEY', 'Falta. Es la clave pública (Publishable o anon).');
  else if (pub.tipo === 'secreta') add('mal', 'SUPABASE_ANON_KEY', '¡Aquí pusiste la clave SECRETA! Pon la pública (Publishable o anon). Como esta se comparte con la página, en Supabase genera una clave secreta nueva y borra la anterior.');
  else if (pub.tipo === 'desconocida') add('mal', 'SUPABASE_ANON_KEY', 'No parece una clave de Supabase. Debe empezar con sb_publishable_ o con eyJ. Cópiala otra vez.');
  else if (pub.ref && refUrl && pub.ref !== refUrl) add('mal', 'SUPABASE_ANON_KEY', 'Esta clave es de otro proyecto de Supabase distinto al de SUPABASE_URL.');
  else add('ok', 'SUPABASE_ANON_KEY', 'Es una clave pública.');

  if (sec.tipo === 'falta') add('mal', 'SUPABASE_SERVICE_ROLE_KEY', 'Falta. Es la clave secreta (Secret o service_role).');
  else if (sec.tipo === 'publica') add('mal', 'SUPABASE_SERVICE_ROLE_KEY', 'Aquí pusiste la clave pública. Va la secreta (sb_secret_… o service_role).');
  else if (sec.tipo === 'desconocida') add('mal', 'SUPABASE_SERVICE_ROLE_KEY', 'No parece una clave de Supabase. Debe empezar con sb_secret_ o con eyJ. Cópiala otra vez.');
  else if (sec.ref && refUrl && sec.ref !== refUrl) add('mal', 'SUPABASE_SERVICE_ROLE_KEY', 'Esta clave es de otro proyecto de Supabase distinto al de SUPABASE_URL.');
  else add('ok', 'SUPABASE_SERVICE_ROLE_KEY', 'Es una clave secreta.');

  // 2) Pruebas de conexión
  const cab = k => ({ apikey: k, ...(/^eyJ/.test(k) ? { Authorization: 'Bearer ' + k } : {}) });
  if (host && (pub.tipo === 'publica')) {
    try {
      const r = await fetch(`${URL_SB}/rest/v1/registros?select=id&limit=1`, { headers: cab(PUB) });
      if (r.ok) add('ok', 'Lectura para la congregación', 'La app puede leer los programas publicados.');
      else add('mal', 'Lectura para la congregación', await explicar(r));
    } catch (e) { add('mal', 'Lectura para la congregación', `No se pudo conectar con ${URL_SB}. Revisa que la URL esté bien escrita.`); }
  }
  if (host && (sec.tipo === 'secreta')) {
    try {
      const r = await fetch(`${URL_SB}/rest/v1/registros?select=coleccion`, { headers: cab(SEC) });
      if (r.ok) {
        const d = await r.json(); const n = Array.isArray(d) ? d.length : 0;
        add(n ? 'ok' : 'aviso', 'Conexión de editores', n ? `Funciona. Hay ${n} registros guardados.` : 'Funciona, pero la tabla está vacía. Entra como editor y en Ajustes carga el ejemplo o importa tu respaldo.');
      } else add('mal', 'Conexión de editores', await explicar(r));
    } catch (e) { add('mal', 'Conexión de editores', `No se pudo conectar con ${URL_SB}.`); }
    try {
      const r = await fetch(`${URL_SB}/storage/v1/bucket/${encodeURIComponent(BUCKET)}`, { headers: cab(SEC) });
      if (r.ok) { const b = await r.json(); add(b.public ? 'ok' : 'mal', `Carpeta de fotos "${BUCKET}"`, b.public ? 'Existe y es pública.' : 'Existe pero no es pública. Corre otra vez supabase.sql.'); }
      else add('mal', `Carpeta de fotos "${BUCKET}"`, 'No existe. Corre supabase.sql completo en SQL Editor.');
    } catch (e) { add('mal', `Carpeta de fotos "${BUCKET}"`, 'No se pudo revisar.'); }
  }

  const malas = filas.filter(f => f.estado === 'mal').length;
  const icono = { ok: '✅', mal: '❌', aviso: '⚠️' };
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Revisión de la app</title>
<style>body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;margin:0;padding:20px 16px 40px;background:#ECEFF3;color:#17202C;line-height:1.45}
main{max-width:560px;margin:0 auto}h1{font-size:1.4rem;margin:0 0 4px}.res{font-weight:700;margin:0 0 16px}
.f{background:#fff;border:1px solid #D5DCE4;border-radius:14px;padding:12px 14px;margin:10px 0;display:grid;grid-template-columns:28px 1fr;gap:2px 8px}
.f b{grid-column:2}.f span{grid-column:2;color:#566172;overflow-wrap:anywhere}.f i{font-style:normal;grid-row:span 2}
.mal{border-color:#E7B4B0}.aviso{border-color:#E9CF9C}p.pie{color:#566172;font-size:.9rem}a{color:#2C52B0}</style></head>
<body><main><h1>Revisión de la app</h1><p class="res">${malas ? `Hay ${malas} cosa${malas > 1 ? 's' : ''} por corregir.` : 'Todo está bien configurado.'}</p>
${filas.map(f => `<div class="f ${f.estado}"><i>${icono[f.estado]}</i><b>${esc(f.titulo)}</b><span>${esc(f.detalle)}</span></div>`).join('')}
<p class="pie">Después de cambiar una variable en Vercel haz Redeploy y vuelve a abrir esta página. <a href="/">Ir a la app</a></p></main></body></html>`;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.statusCode = 200;
  res.end(html);
};
