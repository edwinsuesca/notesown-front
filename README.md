# Notesown

Aplicación de notas personales con texto enriquecido. Angular 21 · Supabase · PrimeNG v21 · PWA.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 21 (standalone, OnPush, signals) |
| UI | PrimeNG v21 + Aura theme (dark/light) |
| Editor | PEditor (Quill) |
| Backend | Supabase (Auth + PostgreSQL + RLS) |
| PWA | @angular/service-worker |
| Tests E2E | Playwright |
| Deploy | Vercel |

## Setup rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ejecuta `supabase-schema.sql` en **SQL Editor** de tu proyecto
3. En **Authentication > Providers > Email**, configura según tu preferencia
4. Copia las credenciales desde **Settings > API**

### 3. Configurar variables de entorno

Edita `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU-ANON-KEY',
};
```

Y también `src/environments/environment.prod.ts` con las mismas credenciales.

### 4. Correr en desarrollo

```bash
npm start
# → http://localhost:4200
```

## Comandos

```bash
npm start                # Servidor de desarrollo
npm run build            # Build de desarrollo
npm run build:prod       # Build de producción
npm run test:e2e         # Tests E2E con Playwright
npm run test:e2e:headed  # Tests E2E con navegador visible
```

## Tests E2E

Requiere credenciales reales de Supabase con un usuario de prueba creado:

```bash
TEST_EMAIL=test@ejemplo.com TEST_PASSWORD=tupassword npm run test:e2e
```

## Deploy en Vercel

1. Conecta el repositorio en [vercel.com](https://vercel.com)
2. Configura las variables de entorno en **Settings > Environment Variables**:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Framework preset: **Angular**
4. Build command: `npm run build:prod`
5. Output directory: `dist/notesown/browser`

El archivo `vercel.json` ya incluye las reglas de rewrite para SPA.

## Estructura del proyecto

```
src/app/
├── core/
│   ├── auth/          # SupabaseAuthService, authGuard, noAuthGuard
│   ├── supabase/      # SupabaseService, database.types.ts
│   └── theme/         # ThemeService (dark/light, localStorage)
├── shared/components/ # EmptyState, ThemeToggle
├── shell/             # Layout principal con sidebar
├── auth/login/        # Página de login/registro
├── books/             # BooksRepository + BooksListComponent
└── notes/             # NotesRepository + Search + Recents
```

## Knowledge Hub

Documentación detallada en `.notesown-hub/`:

- `context/project-overview.md` — Arquitectura y decisiones
- `requirements-docs/` — DDD, BDD, specs técnica y UI
- `skills/` — Guías de Supabase, PrimeNG, PWA
- `workflows/` — Setup Supabase, deploy Vercel, desarrollo de features
