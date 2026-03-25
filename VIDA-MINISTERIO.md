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
│   └── Lectura Bíblica (N min)          ← hermano estudiante (+ lector?)
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
  fecha: "2026-03-23",             // lunes de la semana
  cancionApertura:   123,
  cancionIntermedia: 456,
  cancionCierre:     789,

  presidente:    "pubId",          // quien preside
  oracionApertura: "pubId",
  oracionCierre:   "pubId",

  tesoros: {
    discurso:      { titulo: "...", duracion: 10, pubId: null },
    joyas:         { titulo: "Joyas Espirituales", duracion: 10, pubId: null },
    lecturaBiblica:{ titulo: "Lea Hechos 7:1-16 (N min.)", duracion: 4, pubId: null, ayudante: null }
  },

  ministerio: [                    // array variable (2-4 partes)
    { titulo: "...", tipo: "video"|"discurso"|"demostracion", duracion: N, pubId: null, ayudante: null },
    ...
  ],

  vidaCristiana: [                 // array variable (1-3 partes + estudio)
    { titulo: "...", tipo: "parte"|"estudio_biblico", duracion: N, pubId: null, ayudante: null },
    ...
  ],

  // Metadata de importación
  importadoDeWOL: true,
  creadoEn: timestamp
}
```

### Campo nuevo en doc de congregación

```js
pinVidaMinisterio: "1234"    // PIN del presidente/encargado de este módulo
```

Se agrega también en `admin.html` (editar congregación) y en `admin.js`.

---

## Roles de publicadores (nuevos — se agregan a publicadores existentes)

Los publicadores ya existen en `congregaciones/{congreId}/publicadores`.
Se agregan nuevos roles a la lista de cada uno:

| Rol (interno) | Display | Quiénes pueden tener |
|---------------|---------|----------------------|
| `VM_PRESIDENTE` | Presidente RVM | Hermanos |
| `VM_ORACION` | Oración | Hermanos |
| `VM_TESOROS` | Discurso Tesoros | Hermanos |
| `VM_JOYAS` | Joyas Espirituales | Hermanos |
| `VM_LECTURA` | Lectura Bíblica | Hermanos (estudiantes) |
| `VM_MINISTERIO` | Partes Ministerio | Hermanos y hermanas |
| `VM_VIDA_CRISTIANA` | Vida Cristiana | Hermanos |
| `VM_ESTUDIO_CONDUCTOR` | Conductor Estudio | Hermanos |
| `VM_ESTUDIO_LECTOR` | Lector Estudio | Hermanos |

Para arrancar: se copia la lista de publicadores del módulo de Asignaciones y se
asignan roles VM a mano. Más adelante el módulo tendrá su propia gestión de hermanos.

---

## Importación del programa desde WOL

WOL (Watchtower Online Library) publica cada semana en:
```
https://wol.jw.org/es/wol/dt/r4/lp-s/{año}/{mes}/{día}
```
Donde `{día}` es el lunes de la semana (o cualquier día de esa semana — WOL muestra la semana completa).

### Estrategia — CORS proxy en browser

Sin servidor, usamos un CORS proxy para hacer el fetch client-side:

```js
const fecha = "2026-03-23"; // lunes de la semana
const wolUrl = `https://wol.jw.org/es/wol/dt/r4/lp-s/${fecha.replace(/-/g,'/')}`;
const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(wolUrl)}`;

const html = await fetch(proxyUrl).then(r => r.text());
const doc = new DOMParser().parseFromString(html, 'text/html');
```

### Parser (adaptado de JWGetter a JS)

Los IDs fijos en el HTML de WOL que necesitamos:

```js
// Sección 1 — Tesoros
const s1 = doc.querySelector('#section2');
const discurso      = s1?.querySelector('#p6')?.textContent?.trim();
const joyas         = s1?.querySelector('#p7')?.textContent?.trim();
const lecturaBiblica= s1?.querySelector('#p10')?.textContent?.trim();

// Sección 2 — Ministerio
const s2 = doc.querySelector('#section3');
const ministerio = [];
['#p13','#p14','#p15'].forEach(id => {
  const el = s2?.querySelector(id);
  if (el) ministerio.push(el.textContent.trim());
});

// Sección 3 — Vida Cristiana
const s3 = doc.querySelector('#section4');
const vidaCristiana = [];
['#p17','#p18','#p19','#p20'].forEach(id => {
  const el = s3?.querySelector(id);
  if (el) vidaCristiana.push(el.textContent.trim());
});
```

**Riesgo**: los IDs de párrafo (`#p6`, `#p7`, etc.) pueden cambiar si JW.org modifica el HTML.
El parser debe ser tolerante y hacer fallback a scraping por posición si los IDs no se encuentran.

### Duraciones — parsing de texto

Las duraciones vienen en el título: `"Lea Hechos 7:1-16 (4 min.)"`.
Extraer con regex:
```js
const durMatch = titulo.match(/\((\d+)\s*min/);
const duracion = durMatch ? parseInt(durMatch[1]) : null;
```

---

## Algoritmo de auto-asignación

Igual que el módulo de Asignaciones: **round-robin por rol** con índice persistente.

```js
// Índices por rol (se calculan partiendo del último asignado en historial)
const indices = {
  VM_PRESIDENTE: 0,
  VM_ORACION:    0,
  VM_TESOROS:    0,
  // ...
};

// Por semana:
const enEstaSemana = new Set(); // detecta conflictos
for (const slot of slotsOrdenados) {
  const lista = publicadoresConRol(slot.rolRequerido);
  let i = indices[slot.rolRequerido];
  // Saltear si ya tiene parte esta semana
  while (enEstaSemana.has(lista[i % lista.length]?.id)) {
    i++;
  }
  slot.pubId = lista[i % lista.length]?.id;
  enEstaSemana.add(slot.pubId);
  indices[slot.rolRequerido] = (i + 1) % lista.length;
}
```

**Reglas especiales:**
- `VM_ORACION` apertura y cierre: distintas personas (offset +1)
- Presidente ≠ oración apertura ni cierre
- Conductor estudio ≠ lector estudio

---

## Vistas del módulo

### Vista 1 — Lista de semanas
- Grid de semanas (próximas + historial)
- Card por semana: fecha, estado (✓ completa / ⚠ incompleta / vacía)
- Botón "+ Nueva semana" → import WOL o entrada manual
- Botón "Generar automático" para rango de fechas

### Vista 2 — Programa de la semana
- Encabezado: fecha, canciones
- Las 3 secciones con todos los slots
- Por cada slot: título de la parte + botón asignar publicador
- Indicador visual si slot vacío (rojo) o asignado (nombre del hermano)
- Botón guardar + botón editar canciones

### Vista 3 — Generar automático
- Picker rango de fechas
- Checkbox "Importar programa de WOL automáticamente"
- Checkbox "Tener en cuenta historial previo"
- Checkbox "Reemplazar semanas existentes"
- Botón Generar

### Vista 4 — Gestionar hermanos (VM)
- Lista de publicadores con roles VM
- Filtro por rol VM
- Editar roles de cada uno

---

## Estructura de archivos

```
vida-ministerio/
  ├── index.html      # App (misma estructura que los otros módulos)
  ├── app.js          # Lógica principal
  └── styles.css
```

Se agrega la card "Vida y Ministerio" en `index.html` (selector de módulo) con:
- Color acento: `#EF9F27` (naranja) o uno nuevo de la paleta
- Ícono: libro/podio

---

## PIN y acceso

| Actor | PIN | Puede |
|-------|-----|-------|
| Presidente | `pinVidaMinisterio` (default `"1234"`) | Ver, editar, asignar, generar |
| Visitante | — | (futuro: modo solo lectura del programa) |

El PIN se agrega al doc de congregación y se configura desde `admin.html`.

---

## Fases de implementación

### Fase 1 — MVP
1. Estructura Firestore + PIN en admin
2. Cover de módulo + card en index.html
3. Vista lista de semanas
4. Vista programa de semana (entrada manual de partes + asignación de publicadores)
5. Gestión básica de roles VM en publicadores

### Fase 2 — Importación WOL
6. Parser WOL (CORS proxy + DOMParser)
7. Botón "Importar de WOL" en crear semana

### Fase 3 — Auto-generación
8. Algoritmo round-robin para VM
9. Vista Generar automático

### Fase 4 — Polish
10. Estado de completitud por semana
11. Historial de asignaciones VM

---

## Lo que NO hacer

- No hardcodear el programa de ninguna congregación
- No asumir que los IDs de WOL (`#p6`, `#p7`) son estables — hacer parser tolerante
- No mezclar roles VM con roles de Asignaciones en la misma lista
- No usar `confirm()`, `alert()`, `prompt()` nativos
- No usar `toISOString()` para fechas
