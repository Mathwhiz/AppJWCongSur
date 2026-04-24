## Módulo de Predicación

Módulo **personal** de cada publicador: cronómetro, historial de tiempo, revisitas, estudios y
vista de las salidas del grupo de la semana. Requiere usuario registrado con Google (no disponible
para invitados anónimos).

**Estado al 2026-04-23:** Cronómetro ✅, registro por día ✅, LDC ✅, historial ✅,
revisitas y estudios ✅, metas e historial ✅, resumen WhatsApp ✅,
salidas de la semana (solo grupo propio) ✅, botones rápidos revisita/estudio durante cronómetro ✅,
mapa overlay con territorios filtrados ✅.

---

### Tabs

| Tab | Contenido |
|-----|-----------|
| **Tiempo** | Cronómetro, agregar tiempo manual, stats del mes, historial de días |
| **Salidas** | Salidas del grupo de la semana (solo lectura) |
| **Revisitas y estudios** | CRUD de revisitas y estudios bíblicos personales |
| **Metas e Historial** | Meta mensual personal + historial de meses anteriores |

---

### Firestore — schema

```
usuarios/{uid}/predicacion/{YYYY-MM}
  ├── (doc): minutos, ldcMinutos, revisitas, estudios, updatedAt
  └── dias/{autoId}: fecha (YYYY-MM-DD), minutos, ldcMinutos, creadoEn

usuarios/{uid}/revisitas/{autoId}: nombre, notas, creadoEn, updatedAt
usuarios/{uid}/estudios/{autoId}:  nombre, notas, creadoEn, updatedAt
```

Los contadores de revisitas/estudios del mes se guardan en el doc padre (`predicacion/{mes}`).
La subcolección `dias/` tiene el desglose por día (permite historial granular y eliminación individual).

#### Arrastre de minutos entre meses

Los minutos se acumulan con arrastre: si un mes cerrado termina con 50 min, esos 50 min
pasan al mes siguiente. Solo meses cerrados (anteriores al actual) acumulan arrastre.
El display del mes actual siempre muestra los minutos reales sin redondear.

---

### Cronómetro

- **Start/Stop** guarda `_timerStart` (performance.now) y acumula en `_timerAccum`
- **Iniciar** muestra la label "Iniciado a las HH:MM" y los botones rápidos (revisita / estudio)
- **Reiniciar** resetea acumulador y oculta botones rápidos
- **"+ Agregar al mes"**: aparece cuando `_timerAccum > 0` tras detener; pide fecha y tipo (predicación / LDC); llama `guardarDia()`

Los botones rápidos abre el modal de contacto (revisita o estudio) sin detener el cronómetro.

---

### Tab Salidas de la semana

Muestra las salidas ya registradas por el encargado para el **grupo propio del publicador**
(lunes→domingo de la semana actual). Solo lectura — no permite editar.

**Carga:**
1. `matchedPublisherId → publicadores/{id}.grupoId` → `_grupoId`
2. `grupos/{grupoId}.color` → `_grupoColor` (borde izquierdo de cada card)
3. Lee `congregaciones/{congreId}/salidas` y filtra por `grupoId === _grupoId` y fechas de la semana

**Card de salida:**
- Borde izquierdo del color del grupo (telefónica siempre verde `#1D9E75`)
- Hora · tipo (Campo / Telefónica)
- Territorio (o "Telefónica") · conductor
- Encuentro/familia si aplica
- Botón mapa (solo campo con territorio): abre overlay con territorios filtrados

**Mapa overlay:**
- `<div id="mapa-overlay">` + `<iframe id="mapa-frame">` en `index.html`
- URL: `mapa.html?modo=registrar&enprogreso=92&terrid=92&congre=sur`
- Modo `registrar` renderiza solo los territorios en `enprogreso`
- `terrid` dispara `flyToBounds` automático al territorio (zoom 17, padding 50px)
- Botón "Cerrar" en header del overlay limpia el `src` del iframe

**Funciones globales:** `abrirMapaOverlay(url, titulo)`, `cerrarMapaOverlay()`

---

### Resumen WhatsApp

Botón "Enviar resumen por WhatsApp" en el tab Tiempo genera un mensaje con el mes,
horas totales, LDC, revisitas y estudios. Usa `window.open('https://wa.me/...?text=...')`.

---

### Metas e Historial

- Meta mensual personal: número de horas (int), guardada en `usuarios/{uid}.metaMensualHoras`
- Historial: lista de meses anteriores con horas reales, LDC, revisitas, estudios
- Detecta automáticamente si el usuario es precursor regular/auxiliar para mostrar metas diferenciadas

---

### Auth y permisos

- Guard: `authGuard('acceso_predicacion')` — requiere usuario registrado con Google
- Anónimos ven `view-noauth` con botón de login
- El color del grupo y el `grupoId` se cargan desde el publicador vinculado (`matchedPublisherId`)
- Sin `matchedPublisherId`: el tab Salidas muestra aviso "Tu perfil no tiene un grupo asignado"
