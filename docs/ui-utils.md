## ui-utils.js (`shared/ui-utils.js`)

| Función | Descripción |
|---------|-------------|
| `uiConfirm({ title, msg, confirmText, cancelText, type })` | Modal confirm. `type`: `warn`/`danger`/`info`/`purple` |
| `uiAlert(msg, title)` | Modal informativo |
| `uiDatePicker({ value, min, label })` | Picker de fecha |
| `uiTimePicker({ value, label })` | Picker de hora (teclado numérico) |
| `uiConductorPicker({ conductores, value, label, color })` | Selector con búsqueda |
| `uiTerritorioPicker({ territoriosData, allData, grupo, configData, label, color })` | Selector de territorio |
| `uiLoading.show(text)` / `uiLoading.hide()` | Overlay de carga |
| `uiToast(msg, type, duration)` | Toast. `type`: `success`/`error` |
| `upgradeInputs(container)` | Reemplaza inputs date/time/select por pickers custom. **Al setear `.value` programáticamente hay que disparar `dispatchEvent(new Event('change', { bubbles: true }))`** |

**Nunca usar `confirm()`, `alert()`, `prompt()` nativos.**

---

## Estilos

> El sistema visual completo está en **[docs/UI-STYLE.md](./UI-STYLE.md)**. Leerlo antes de tocar UI.

- Tema oscuro: `#1a1c1f` bg · `#e8e8e8` texto · `#232628` cards · `#252525` modales
- Max-width: apps `480px`, covers `320–340px`
- Fuente: `system-ui, sans-serif` — sin Google Fonts
- Vistas con clase `.view` tienen `fadeIn` 0.2s
- Versionado de assets: `styles.css?v=X.X` — incrementar al hacer cambios
