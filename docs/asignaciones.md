## Módulo de Asignaciones

### Roles de reunión (tabla semanal)
`LECTOR`, `SONIDO_1`, `SONIDO_2`, `PLATAFORMA`, `MICROFONISTAS_1`, `MICROFONISTAS_2`,
`ACOMODADOR_AUDITORIO`, `ACOMODADOR_ENTRADA`, `PRESIDENTE`, `REVISTAS`, `PUBLICACIONES`

### Roles en lista de publicadores (Firestore)
Los publicadores se guardan con roles sin número: `SONIDO`, `MICROFONISTAS`.
El `ROL_LISTA_MAP` los mapea al cargar:
```js
const ROL_LISTA_MAP = {
  SONIDO:          'SONIDO_1',
  SONIDO_2:        'SONIDO_1',
  MICROFONISTAS:   'MICROFONISTAS_1',
  MICROFONISTAS_2: 'MICROFONISTAS_1',
};
```

### Roles extra (solo en lista de publicadores)
`CONDUCTOR_GRUPO_1..4`, `CONDUCTOR_CONGREGACION`

### Generar automático
- **`#auto-desde` / `#auto-hasta`**: rango. Pre-llenado: última fecha guardada + 1 semana → +3 meses.
- **"Tener en cuenta historial previo"**: busca el último asignado por rol y arranca desde el siguiente.
- **"Reemplazar semanas existentes"**: incluye fechas que ya tienen datos en el rango.
- **Algoritmo**: round-robin por rol; `SONIDO_2`/`MICROFONISTAS_2` con offset +1; `PRESIDENTE` omitido en miércoles; `Set enEstaReunion` detecta conflictos.
- **Semanas especiales**: ✅ implementado — respeta `tipoEspecial` al generar (`asamblea` → saltear ambas reuniones, `conmemoracion` entre semana → saltear miércoles, `superintendente` → generar martes en lugar de miércoles, sábado sin lector).

### Back buttons en vistas de encargado
Las vistas `view-editar`, `view-automatico`, `view-imagen` usan `onclick="goToEncargado()"` — **no** `showView('view-encargado')` directamente. `goToEncargado()` también llama `cargarEspeciales()`.

### Integración con Google Sheets (opcional)
- Botón "Guardar también en planilla" si `scriptUrl` está en Firestore
- Envía de a una reunión por fetch (`no-cors`, `keepalive: true`)
- Respuesta opaca — no se puede confirmar éxito, se asume OK
- **Pendiente mejorar:** agregar confirmación de éxito o mecanismo de retry
