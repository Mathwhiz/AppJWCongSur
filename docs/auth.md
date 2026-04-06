## Sistema de Auth y Perfiles (✅ implementado)

### Flujo de entrada

```
Abrir app
  └─ ¿hay congregación en localStorage?
       SÍ → ¿hay sesión Firebase activa?
              Google/Anónima → menú de módulos directo
              Sin sesión     → view-auth (sign-in o skip)
       NO  → selector de congregaciones → view-auth
```

### Proveedores activos en Firebase Console
- **Google** — sign-in completo con perfil
- **Anónimo** — acceso inmediato sin fricción ("Omitir por ahora")

### Documento de usuario (`usuarios/{uid}`)

```js
{
  uid:               "firebase-uid",
  email:             "user@gmail.com" | null,
  displayName:       "Juan Pérez"    | null,
  photoURL:          "https://..."   | null,
  birthDate:         "1990-05-15"    | null,   // YYYY-MM-DD
  sexo:              "H" | "M"       | null,
  matchedPublisherId: "pubId"        | null,   // ref a publicadores/{id}
  congregacionId:    "sur"           | null,
  appRol:            "publicador",             // legacy — primer rol del array (backward compat)
  appRoles:          ["publicador"],           // ← array de roles (soporta multi-rol)
  grupoEncargado:    "1" | null,               // solo relevante si appRoles incluye 'encargado_grupo'
  matchEstado:       "ok" | "pendiente" | "sin_match" | "anonimo",
  isAnonymous:       false,
  primerLogin:       false,
  createdAt:         timestamp,
}
```

**Multi-rol:** un usuario puede tener varios roles simultáneos, ej: `["encargado_grupo", "encargado_vm"]`. `hasPermission()` verifica la unión de permisos de todos los roles. Usuarios legacy sin `appRoles` se normalizan en runtime a `[appRol]`.

### Roles y permisos (`shared/auth-config.js`)

Único archivo a editar para cambiar qué puede hacer cada rol.

| Rol | Descripción |
|-----|-------------|
| `admin_general` | Acceso a todo, incluyendo `admin.html` |
| `admin_congre` | Todos los módulos de una congregación |
| `encargado_asignaciones` | Asignaciones + Administrador |
| `encargado_vm` | Vida y Ministerio + Administrador |
| `encargado_grupo` | Territorios |
| `anciano` | Territorios + VM |
| `siervo_ministerial` | Territorios |
| `precursor_regular` | Territorios |
| `precursor_auxiliar` | Territorios |
| `publicador` | Territorios |
| `anonimo` | Todos los módulos (igual que antes del sistema de perfiles) |
| `pendiente` | Sin acceso — match no confirmado por admin |

### Matching automático con publicadores

Al registrarse con Google, `auth.js` intenta matchear `displayName` con `publicadores/{id}.nombre`:
1. Coincidencia exacta (normalizado: lowercase, sin tildes)
2. Todos los tokens del nombre de Google presentes en el nombre del pub
3. Si ambiguo (`matchEstado: 'pendiente'`) → admin resuelve en `admin.html`

**Tabla de `appRol` asignado al crear el doc (lógica en `auth.js`):**

| `matchEstado` | `appRol` asignado | Motivo |
|---------------|-------------------|--------|
| `ok` | `publicador` | Coincidencia exacta con un publicador |
| `pendiente` | `pendiente` | Coincidencia ambigua — admin debe confirmar cuál publicador es |
| `sin_match` | `publicador` | Sin coincidencia — acceso base; admin puede elevar el rol después |

> ⚠️ Solo `matchEstado: 'pendiente'` (ambiguo) bloquea el acceso. `sin_match` **no** bloquea — de lo contrario, congregaciones sin `publicadores` cargados en Firestore dejarían a todos los usuarios nuevos sin acceso.

La misma lógica aplica en `linkWithGoogle()` (anónimo → Google).

### API global expuesta por `shared/auth.js`

| Función | Descripción |
|---------|-------------|
| `window.waitForAuth()` | Promise → resuelve con el usuario cuando `onAuthStateChanged` disparó |
| `window.currentUser` | Objeto usuario actual (null si no logueado) |
| `window.hasPermission(feature)` | Boolean — verifica `PERMISOS[appRol].includes(feature)` |
| `window.authGuard(feature)` | Async — redirige a `/?sin_acceso=1` si no tiene permiso |
| `window.signInWithGoogle()` | Abre popup de Google |
| `window.signInAnonymousUser()` | Crea sesión anónima |
| `window.linkWithGoogle()` | Vincula sesión anónima con Google → luego redirigir a `perfil.html` |
| `window.signOutUser()` | Cierra sesión Firebase |
| `window.updateUserProfile(data)` | Actualiza `usuarios/{uid}` en Firestore y en memoria |

### Session header (`shared/ui-utils.js`)

Chip flotante fijo en `top: 12px; right: 12px` — aparece en todas las páginas que cargan `ui-utils.js`.

- Google: muestra foto (o iniciales) + primer nombre → menú: "Ver perfil" / "Cerrar sesión"
- Anónimo: ícono genérico + "Invitado" → menú: "Vincular con Google" / "Cerrar sesión"
- `window.updateSessionHeader(user)` — llamado por `auth.js` en cada cambio de estado
- `window.sessionSignOut()` — limpia localStorage + sessionStorage + Firebase + redirige a `/`
- `window.toggleSessionMenu()` / `window.closeSessionMenu()` — control del dropdown

### Persistencia de congregación

| Almacenamiento | Keys | Cuándo se escribe | Cuándo se borra |
|----------------|------|-------------------|-----------------|
| `localStorage` | `ziv_congre_id`, `ziv_congre_nombre`, `ziv_congre_color` | Al elegir congregación | Solo al cerrar sesión |
| `sessionStorage` | `congreId`, `congreNombre`, `congreColor` | Al elegir congregación o al restaurar desde localStorage | Al cerrar sesión o "← Congregaciones" |

**"← Congregaciones"** solo limpia `sessionStorage` → el usuario puede cambiar de congregación en esta pestaña, pero la próxima visita vuelve a la guardada.

### `perfil.html`

- Primer login (`primerLogin: true`): título "Completá tu perfil", botón "Guardar y continuar", setea `primerLogin: false`
- Edición (`primerLogin: false`): título "Tu perfil", botón "Guardar cambios"
- Usuarios anónimos: redirigidos a `/` (no tienen perfil)
- DOB picker custom con dropdown de año (año actual → 1900) y mes — sin `<input type="date">`

**Arquitectura del script (importante):**
- `waitForAuth()` es el mecanismo **primario** para el render inicial — siempre resuelve (el `finally` de `auth.js` lo garantiza)
- El listener `authStateChanged` solo se usa para detectar cierre de sesión **después** de que el perfil ya se renderizó (flag `_perfilCargado`)
- Timeout de seguridad de 10 s: si `waitForAuth()` no resuelve (Firestore colgado), redirige a `/`
- El div del título tiene `id="titulo-perfil"` — **no usar** `querySelector('[style*="..."]')` para encontrar elementos por texto

### Guards activos por módulo (✅ implementado)

Cada `app.js` llama `authGuard` justo después de los imports:

| Módulo | Guard |
|--------|-------|
| `territorios/app.js` | `await window.authGuard('acceso_territorios')` |
| `asignaciones/app.js` | `await window.authGuard('acceso_asignaciones')` |
| `vida-ministerio/app.js` | `await window.authGuard('acceso_vm')` |
| `hermanos/app.js` | `await window.authGuard('acceso_hermanos')` |

Si no tiene permiso → redirige a `/?sin_acceso=1` → `index.html` muestra un toast de error y limpia el parámetro de la URL.

**Logs de diagnóstico en `shared/auth.js`** (visibles en DevTools → Console):
- `[auth] usuario cargado:` — uid, appRol, matchEstado, primerLogin en cada carga de página
- `[auth] nuevo usuario creado:` — al registrarse por primera vez
- `[authGuard] acceso_X { ... allowed }` — qué rol tiene y si se permite el acceso
- `[auth] Error al cargar usuario — authGuard bloqueará el acceso:` — si Firestore falla
