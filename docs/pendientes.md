## Ideas pendientes (futuro)

### Dashboard de estadísticas (más adelante)
- Territorios trabajados por mes/gráfico
- Publicadores más activos
- Tiempo promedio entre usos de territorio
- Asistencias y participaciones en reuniones

### Reportes PDF (más adelante)
- Informe mensual de territorios
- Historial completo de un territorio
- Resumen de asignaciones del mes

### Exportar historial a Excel/CSV (más adelante)
- Exportar todo el historial a Excel/CSV
- Backup completo de la congregación

### Widgets en pantalla principal (ANOTAR)
- Mostrar resumen rápido (próximas salidas, esta semana en reunión)
- Requiere que cada publicador pueda elegir ver su congregación

### Responsive mejorado (ANOTAR)
- Optimizar para tablets (actualmente mobile-first)

### Seguridad — en progreso
- ✅ Firebase Auth con Google + Anónimo
- ✅ Roles de usuario + mapa de permisos (`shared/auth-config.js`)
- ✅ Matching automático con publicadores existentes
- ✅ Session header global
- ✅ Persistencia de congregación en localStorage
- ✅ Guards activos en módulos — `authGuard()` llamado al inicio de cada `app.js`
- ✅ Resolución de matches ambiguos en `admin.html` (vista `view-matches`)
- ⬜ Reemplazar PINs internos por auth real (decisión pendiente)
- ✅ PIN Administrador endurecido: `view-menu` ya no tiene `active` al inicio. El PIN modal cubre una página vacía; solo tras validación correcta se navega a `view-menu`. Pendiente migrar a auth/backend real.
- ⬜ Auditoría: log de cambios importantes (quién modificó qué y cuándo)

### Mejorar integración Google Sheets (Asignaciones)
- Fetch actual usa `no-cors` + `keepalive:true` → respuesta opaca, no se puede confirmar éxito
- Pendiente: agregar confirmación real o mecanismo de retry/estado

### Investigar demora al volver de módulo a selección de módulo (ANOTAR)
- Al navegar `../index.html` o `../index.html#menu` desde un módulo, hay ~500ms de delay visible
- Causa probable: Firebase Auth tarda en restaurar la sesión (`onAuthStateChanged` no es síncrono)
- Mitigación aplicada: `mostrarMenu()` optimista antes de `waitForAuth()`, pero el re-render puede producir flash
- Pendiente: investigar si se puede cachear el estado de auth en sessionStorage para evitar el round-trip

### Privilegios por registro — usar `appRol` en la app (ANOTAR)
- Actualmente el sistema de roles existe (`shared/auth-config.js`, `authGuard`, `hasPermission`) pero no se usa en la UI para personalizar la experiencia del usuario
- Pendiente: mostrar/ocultar funcionalidades según el rol del usuario registrado (ej: botón "Encargado" solo visible para roles habilitados, info de territorios personalizada para el grupo del publicador)
- Requiere vincular `matchedPublisherId` con los datos del publicador para saber su grupo, sus asignaciones, etc.

### Mejorar perfil de la web al registrarse (ANOTAR)
- El flujo actual de registro (`perfil.html`) es funcional pero básico
- Pendiente: mejorar la experiencia visual y de onboarding al registrarse con Google
  - Mostrar la foto de perfil de Google y permitir cambiarla
  - Indicar al usuario qué puede hacer con su perfil (acceso a módulos según rol)
  - Mostrar el estado del match con publicadores de forma más clara
  - Posiblemente un wizard de bienvenida de 2-3 pasos para nuevos usuarios
