// Le dice a la app a qué base de datos conectarse (datos públicos, sin secretos).
const limpiarUrl = v => String(v || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '').replace(/\/+$/, '');
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    url: limpiarUrl(process.env.SUPABASE_URL),
    anonKey: String(process.env.SUPABASE_ANON_KEY || '').trim()
  });
};
