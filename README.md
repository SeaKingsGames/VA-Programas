[README.md](https://github.com/user-attachments/files/32977959/README.md)
# Programas de la congregación

App web para ver y editar los programas con fotos. Se sube la carpeta tal cual a Vercel, sin compilar.

| Archivo | Para qué |
|---|---|
| `index.html` | La app (lectores y editores) |
| `api/editar.js` | Revisa la contraseña de editores y guarda los cambios |
| `api/config.js` | Le dice a la app a qué base de datos conectarse |
| `supabase.sql` | Crea la tabla, los permisos y la carpeta de fotos |
| `sw.js`, `manifest.webmanifest`, `*.png` | Para instalarla como app |

- **Lectores** (toda la congregación): abren el link, sin contraseña. Solo ven lo publicado.
- **Editores**: tocan el lápiz y escriben la contraseña de editores. Pueden marcar "Recordar en este teléfono" (30 días).

## Probar sin configurar nada

Abre `index.html` en el navegador: funciona en **modo demo** con octubre 2026 cargado y guarda todo solo en ese dispositivo (sin contraseña, porque no hay servidor).

## Publicarla para la congregación

1. **Supabase**: crea un proyecto. En *SQL Editor > New query* pega `supabase.sql` y presiona **Run**.
2. **Supabase > Project Settings > API Keys**: vas a necesitar
   - la *Project URL*,
   - la clave **pública** (`anon` o `sb_publishable_…`),
   - la clave **secreta** (`service_role` o `sb_secret_…`).
3. Sube esta carpeta a GitHub e impórtala en **Vercel** (Framework: *Other*, sin comando de build).
4. En **Vercel > Settings > Environment Variables** agrega:

   | Nombre | Valor |
   |---|---|
   | `CLAVE_EDITORES` | La contraseña de los editores (mínimo 10 caracteres, que no sea fácil de adivinar) |
   | `SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | La clave pública |
   | `SUPABASE_SERVICE_ROLE_KEY` | La clave secreta |

5. **Deployments > ⋯ > Redeploy** (las variables solo aplican a partir de un nuevo deploy).
6. Abre el link, toca el lápiz, escribe la contraseña y en **Ajustes** usa *Cargar ejemplo de octubre 2026* o *Importar respaldo*. Si importas un respaldo del demo, las fotos se suben solas a Supabase.

## Cambiar la contraseña o quitarle el acceso a alguien

Cambia `CLAVE_EDITORES` en Vercel y haz **Redeploy**. Todas las sesiones abiertas se cierran y cada editor tiene que escribir la contraseña nueva.

## Seguridad, en corto

- La contraseña vive solo en Vercel; no está en `index.html`, así que no se puede ver con "ver código fuente".
- La clave secreta de Supabase también vive solo en Vercel. La clave pública solo puede **leer lo publicado**: no puede escribir ni ver borradores.
- Si alguien escribe mal la contraseña, el servidor tarda un poco en responder para frenar a quien intente adivinarla.

## Instalar en el teléfono

- **Android (Chrome):** al abrir el link aparece "Tenla en tu pantalla de inicio" con el botón **Instalar** (o menú ⋮ > *Instalar app*).
- **iPhone (Safari):** Compartir > *Agregar a inicio*. La app lo indica la primera vez.

Instalada se abre a pantalla completa y, sin internet, muestra los últimos programas cargados. Si cambias `index.html`, sube el número de `VERSION` en `sw.js` para que todos reciban la versión nueva.

## Cómo está pensado

- **Formatos por fechas**: rotaciones del mes (Departamentos, Limpieza, Hospitalidad, Sordociegos). Cada asignación puede ser *personas con foto*, *grupo/opción* o *texto*; puede ser "para una persona" (el sordociego) y numerar turnos.
- **Formatos de reunión**: partes con sección de color, ícono, minutos, tema y personas con etiqueta (Conductor, Lector…).
- **Grupos**: si a cada persona le pones su grupo, en Limpieza y Hospitalidad salen las caras del grupo.
- Al elegir a alguien, la app avisa si ya tiene otra asignación ese mismo día.
