# Módulo Vida y Ministerio — Plan de Implementación

App para que el **presidente de la reunión Vida y Ministerio Cristiano** prepare y asigne
el programa semanal de forma automática, con edición rápida.

---

## Estructura del programa semanal

Cada semana (lunes) tiene partes fijas + partes variables importadas de WOL:

```
Canción de apertura + Oración apertura
│
├── SECCIÓN 1: TESOROS DE LA PALABRA DE DIOS
│   ├── Discurso (10 min)                ← hermano
│   ├── Joyas Espirituales (10 min)      ← hermano
│   └── Lectura Bíblica (N min)          ← hermano estudiante (+ lector auxiliar si hay sala)
│
├── Canción intermedia
│
├── SECCIÓN 2: SEAMOS MEJORES MAESTROS
│   ├── Parte 1 (N min)                  ← hermano/hermana (+ ayudante?)
│   ├── Parte 2 (N min)                  ← hermano/hermana (+ ayudante?)
│   └── Parte 3 (N min, opcional)        ← hermano/hermana (+ ayudante?)
│
├── SECCIÓN 3: NUESTRA VIDA CRISTIANA
│   ├── Parte 1 (N min)                  ← hermano
│   ├── Parte 2 (N min, opcional)        ← hermano
│   └── Estudio Bíblico Congregacional   ← conductor + lector
│
└── Canción de cierre + Oración cierre
```

Roles con **ayudante**: Lectura Bíblica, partes de Sección 2 (demostraciones), posiblemente Sección 3.
Solo hermanos pueden presidir, dar Tesoros, Vida Cristiana y conducir Estudio.
Hermanos y hermanas pueden dar partes de Sección 2.

---

## Arquitectura Firestore

```
congregaciones/{congreId}/
  └── vidaministerio/{semanaId}   ← semanaId = fecha del lunes "YYYY-MM-DD"
```

### Documento de semana

```js
{
  fecha: "2026-03-23",
  cancionApertura:   123,
  cancionIntermedia: 456,
  cancionCierre:     789,

  presidente:      "pubId",
  oracionApertura: "pubId",
  oracionCierre:   "pubId",

  tesoros: {
    discurso:       { titulo: "...", duracion: 10, pubId: null },
    joyas:          { titulo: "Joyas Espirituales", duracion: 10, pubId: null },
    lecturaBiblica: { titulo: "Lea Hechos 7:1-16 (N min.)", duracion: 4, pubId: null, ayudante: null,
                      salaAux: { pubId: null, ayudante: null } }  // si tieneAuxiliar
  },

  ministerio: [
    { titulo: "...", tipo: "video"|"discurso"|"demostracion", duracion: N,
      pubId: null, ayudante: null,
      salaAux: { pubId: null, ayudante: null } },  // si tieneAuxiliar y tipo != discurso
    ...
  ],

  vidaCristiana: [
    { titulo: "...", tipo: "parte"|"estudio_biblico", duracion: N, pubId: null, ayudante: null },
    ...
  ],

  tipoEspecial: null | "conmemoracion" | "superintendente" | "asamblea",

  importadoDeWOL: true,
  creadoEn: timestamp
}
```

### Campos en doc de congregación

```js
pinVidaMinisterio: "1234"   // PIN del presidente/encargado
tieneAuxiliar: false         // toggle desde config del módulo
```

---

## Roles de publicadores

Los publicadores ya existen en `congregaciones/{congreId}/publicadores`.
Se agregan nuevos roles a la lista de cada uno:

| Rol (interno) | Display | Quiénes |
|---------------|---------|---------|
| `VM_PRESIDENTE` | Presidente RVM | Hermanos |
| `VM_ORACION` | Oración (apertura/cierre) | Hermanos |
| `VM_TESOROS` | Discurso Tesoros | Hermanos |
| `VM_JOYAS` | Joyas Espirituales | Hermanos |
| `VM_LECTURA` | Lectura Bíblica | Hermanos (varones) |
| `VM_MINISTERIO_CONVERSACION` | Conversación (1a/2a) | Hermanos y hermanas |
| `VM_MINISTERIO_REVISITA` | Revisita | Hermanos y hermanas |
| `VM_MINISTERIO_ESCENIFICACION` | Escenificación | Hermanos y hermanas |
| `VM_MINISTERIO_DISCURSO` | Discurso SMM | Hermanos (varones, ~5 min) |
| `VM_VIDA_CRISTIANA` | Discurso Vida Cristiana | Hermanos |
| `VM_ESTUDIO_CONDUCTOR` | Conductor Estudio | Hermanos |

> El lector del estudio bíblico viene del módulo de Asignaciones — no se duplica aquí.

---

## Importación del programa desde WOL (✅ implementado)

URL: `https://wol.jw.org/es/wol/dt/r4/lp-s/{año}/{mes}/{día}`

Fetch via Cloudflare Worker propio (`https://super-math-a40f.mnsmys12.workers.dev/`) + fallbacks.

**Parser real** (los IDs `#pN` varían — NO usarlos):
- Títulos en `h3/h4` con texto `"N. Título..."`.
- Frontera Ministerio/VC: `h3` con texto exactamente `"Canción N"`.
- Duración: primer `"(X mins.)"` después del `h3` correspondiente.
- Tesoros: siempre los primeros 3 h3 numerados.
- Canciones: por posición (apertura / intermedia / cierre).

---

## Detección de tipo de parte (para auto-asignación)

```js
function tipoMinisterioDesdeWOL(titulo) {
  const t = titulo.toLowerCase();
  if (t.includes('conversación'))  return 'conversacion';
  if (t.includes('revisita'))      return 'revisita';
  if (t.includes('escenificación') || t.includes('escenificacion')) return 'escenificacion';
  if (t.includes('discurso'))      return 'discurso'; // varón, sin ayudante
  return 'conversacion';
}

const TIPO_ROL_MAP = {
  conversacion:  'VM_MINISTERIO_CONVERSACION',
  revisita:      'VM_MINISTERIO_REVISITA',
  escenificacion:'VM_MINISTERIO_ESCENIFICACION',
  discurso:      'VM_MINISTERIO_DISCURSO',
};
```

Regla: `tipo === 'discurso'` → sin ayudante. Los demás → tienen ayudante.

---

## Semanas especiales (`tipoEspecial`)

Campo en el doc de semana. Tres valores:

| Valor | Cuándo | Efecto |
|-------|--------|--------|
| `"conmemoracion"` | 1x año | Si entre semana: no hay reunión VM. Si finde: no hay reunión de fin de semana. |
| `"superintendente"` | ~2x año | Reunión pasa de miércoles a martes. Estudio Bíblico reemplazado por discurso del sup. Finde sin lector. |
| `"asamblea"` | ~2x año | No hay ninguna reunión esa semana. |

La UI ya muestra aviso/banner cuando `tipoEspecial` está seteado.
**Pendiente**: que el generador automático de Asignaciones lo respete al generar (ver más abajo).

---

## Algoritmo de auto-asignación (Fase 4 — pendiente)

Round-robin por rol con índice persistente, igual que el módulo de Asignaciones:

```js
const indices = { VM_PRESIDENTE: 0, VM_ORACION: 0, /* ... */ };

// Por semana:
const enEstaSemana = new Set();
for (const slot of slotsOrdenados) {
  const lista = publicadoresConRol(slot.rolRequerido);
  let i = indices[slot.rolRequerido];
  while (enEstaSemana.has(lista[i % lista.length]?.id)) i++;
  slot.pubId = lista[i % lista.length]?.id;
  enEstaSemana.add(slot.pubId);
  indices[slot.rolRequerido] = (i + 1) % lista.length;
}
```

**Reglas especiales:**
- `VM_ORACION` apertura ≠ cierre (índice +1 para el segundo)
- Presidente ≠ oración apertura ni cierre
- Conductor estudio ≠ lector
- `tipo === 'discurso'` en Ministerio: sin ayudante, solo varones
- Si `tipoEspecial === 'asamblea'` → saltear semana completa
- Si `tipoEspecial === 'superintendente'` → sin `vidaCristiana[last]` (discurso del sup)
- Si `tipoEspecial === 'conmemoracion'` entre semana → saltear reunión VM

**Sala auxiliar (si `tieneAuxiliar`):**
- `tesoros.lecturaBiblica.salaAux.pubId` = siguiente en lista `VM_LECTURA`
- Partes de ministerio tipo demo: `salaAux.pubId` y `salaAux.ayudante` = siguientes en lista

---

## Estado de implementación

### ✅ Fase 1 — MVP
### ✅ Fase 2 — Importación WOL
### ✅ Sala auxiliar
### ✅ Importación historial Excel (`tools/import_vm_historial.py`)
### ✅ Semanas especiales — UI (banner/aviso en vista semana)
### ✅ PIN VM configurable desde superadmin
### ✅ Navegación ← → entre semanas
### ✅ Vista mensual de semanas
### ✅ Editar títulos de partes manualmente
### ✅ Duración de partes visible
### ✅ Export / Compartir programa (Sheets + captura)

---

## Pendiente

### Fase 4 — Auto-asignación VM

1. **Guardar `tipo` al importar WOL** — `tipoMinisterioDesdeWOL(titulo)` en el parser
2. **Gestión de hermanos VM** — nueva vista: lista publicadores con toggle de roles VM
3. **Vista "Generar automático"** — rango fechas + checkboxes historial/reemplazar + botón Generar
   - Por cada semana: import WOL si no existe → asignar publicadores
   - Respetar `tipoEspecial` al generar
4. **Algoritmo round-robin** — ver sección arriba
5. **Sala auxiliar en auto-asignación** — asignar pares para ambas salas en ministerio

### Semanas especiales en generador de Asignaciones

Al generar un rango de fechas en Asignaciones, si una semana tiene `tipoEspecial`:
- `"asamblea"` → no generar ninguna reunión esa semana
- `"conmemoracion"` entre semana → no generar roles de reunión VM/entre semana
- `"superintendente"` → reunión pasa a martes, sin lector de finde

---

## Lo que NO hacer

- No hardcodear el programa de ninguna congregación
- **No usar IDs de párrafo WOL (`#p6`, `#p7`, etc.)** — varían cada semana
- No mezclar roles VM con roles de Asignaciones en la misma lista
- No usar `confirm()`, `alert()`, `prompt()` nativos
- No usar `toISOString()` para fechas
