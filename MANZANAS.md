# Plan: Manzanas por Territorio

Sub-polígonos numerados dentro de cada territorio, importados desde OpenStreetMap o dibujados a mano.

---

## Estructura de datos en Firestore

```
congregaciones/{congreId}/territorios/{terrId}/manzanas/{manzanaId}
  ├── numero: 1                          ← número visible en el mapa
  ├── coords: [{lat, lng}, ...]          ← polígono de la manzana
  └── (futuro) estado, fechaUltimo, etc.
```

Subcolección de `territorios`, no campo dentro del doc. Así no se rompe nada existente — si un territorio no tiene manzanas, simplemente la subcolección está vacía.

---

## Fase 1 — Importar desde OpenStreetMap (Overpass API)

### Cómo funciona

La Overpass API devuelve todos los `way` con tag `highway` dentro de un polígono dado. Con esas calles se pueden calcular los bloques urbanos (manzanas) como los polígonos que quedan entre las calles.

La query base:

```
[out:json];
(
  way["highway"](poly:"lat1 lng1 lat2 lng2 ...");
);
out geom;
```

Eso devuelve las calles con sus coordenadas. El paso siguiente es calcular los bloques: la forma más práctica es usar **Turf.js** que tiene `polygonize` — toma una red de líneas y devuelve los polígonos que forman.

### Flujo en admin.html

1. El admin entra al territorio y toca **"Importar manzanas de OSM"**
2. Se hace la query a Overpass con el polígono del territorio como bounding
3. Se corre `turf.polygonize()` sobre las calles devueltas
4. Se filtran los polígonos que quedan **dentro** del territorio (`turf.booleanWithin`)
5. Se muestran en el mapa para revisión antes de guardar
6. El admin puede:
   - Confirmar y guardar todo en Firestore
   - Descartar y no guardar nada
   - (Fase 2) Editar el resultado antes de guardar

### Dependencias a agregar en admin.html

```html
<script src="https://unpkg.com/@turf/turf@6/turf.min.js"></script>
```

Turf.js es una librería de geometría geoespacial, sin backend, corre 100% en el browser.

### Riesgo principal

OSM puede no tener todas las calles mapeadas en zonas rurales o barrios informales. Si la query devuelve pocas calles, los bloques calculados van a ser incorrectos o incompletos. Por eso el paso de revisión visual antes de guardar es importante.

---

## Fase 2 — Editor manual (para corregir o dibujar desde cero)

Si el resultado de OSM es malo, el admin puede dibujar o editar las manzanas a mano.

### Herramienta: Leaflet.Draw

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css">
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
```

Permite dibujar polígonos con clicks en el mapa. El flujo:

1. Admin abre el editor de un territorio
2. Ve el territorio y las manzanas existentes (si las hay)
3. Puede:
   - **Agregar** una manzana dibujando un polígono
   - **Editar** los vértices de una manzana existente
   - **Borrar** una manzana
4. Cada cambio se guarda en Firestore en tiempo real o con un botón "Guardar"

---

## Fase 3 — Visualización en el mapa de territorios

Una vez que hay manzanas en Firestore, mostrarlas en `mapa.html`.

### Cambios en mapa.html

- Cargar la subcolección `manzanas` de cada territorio visible
- Renderizar como polígonos más pequeños dentro del territorio, con un label con el número
- Solo cargarlas cuando el zoom es suficientemente alto (ej: zoom >= 15) para no saturar
- Color diferenciable del territorio base (ej: borde blanco semitransparente, fill más claro)

```js
// Ejemplo de carga lazy por zoom
map.on('zoomend', () => {
  if (map.getZoom() >= 15) cargarManzanasVisibles();
});
```

---

## Orden de implementación recomendado

1. **Testear cobertura OSM primero**: antes de escribir código, hacer una query manual a Overpass en [overpass-turbo.eu](https://overpass-turbo.eu) con el polígono de uno de tus territorios y ver qué tan buenas son las calles devueltas.

2. **Fase 1** (importar de OSM en admin.html) — es lo que da más valor con menos trabajo manual.

3. **Fase 3** (visualización) — se puede hacer en paralelo o después de tener datos de prueba.

4. **Fase 2** (editor manual) — solo si OSM no alcanza para cubrir los territorios.

---

## Lo que NO hay que tocar

- `territorios/app.js` — no necesita cambios, las manzanas son datos extras
- La estructura de `territorios/{terrId}` — se agrega subcolección, no se modifica el doc
- `firebase.js` — sin cambios
- La lógica de historial, salidas, asignaciones — completamente independiente
