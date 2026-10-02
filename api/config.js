// Le dice a la app a qué base de datos conectarse (datos públicos, sin secretos).
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  });
};
