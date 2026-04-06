# Security Test

## Alcance de este primer análisis

Este documento resume el análisis práctico inicial del proyecto pensando en un atacante usando solo el navegador y DevTools (`F12`).

Importante:

- En este repo no apareció un archivo de reglas de Firestore (`firestore.rules`, `firebase.json`, `.firebaserc`).
- Por eso no fue posible auditar todavía las reglas reales del backend.
- Sí fue posible revisar el frontend, la estructura de datos usada por el cliente y varios riesgos concretos que existen si las reglas no están bien cerradas.

## Qué se analizó realmente

No fue solo el punto 1.

Se revisó:

- uso de Firestore desde el frontend
- lógica de autenticación y autorización en cliente
- campos sensibles escritos desde el navegador
- manejo de PINs y secretos en Firestore
- selección de congregación desde `sessionStorage`
- acciones manualmente ejecutables desde la consola

Lo que no se pudo confirmar todavía fue el comportamiento exacto de las Firestore Security Rules, porque ese archivo no está en el repo.

## Qué son las Firestore Security Rules

Las Firestore Security Rules son las reglas del backend de Firebase que deciden:

- quién puede leer documentos
- quién puede crear documentos
- quién puede modificar documentos
- quién puede borrar documentos
- qué campos se pueden cambiar
- si un usuario puede acceder solo a su propia congregación, su propio `uid`, etc.

Esas reglas no están en el frontend. Normalmente viven en archivos como:

- `firestore.rules`
- `firebase.json`
- `.firebaserc`

Y se despliegan a Firebase con la CLI.

Sin esas reglas, el frontend no protege nada por sí solo.

## Hallazgos actuales

### Vulnerabilidades críticas

#### 1. El “superadmin PIN” está en Firestore y se valida 100% en cliente

Referencias:

- `admin.js`
- `docs/arquitectura.md`

Código relevante:

- `admin.js` lee `config/superadmin.pin`
- luego compara el PIN en JavaScript del navegador

Explicación:

Si el navegador puede leer el PIN desde Firestore, entonces ese PIN ya no es un secreto real.

Cómo se explotaría desde F12:

```js
import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js').then(async ({doc,getDoc}) => {
  const { db } = await import('/shared/firebase.js');
  const snap = await getDoc(doc(db, 'config', 'superadmin'));
  console.log(snap.data());
});
```

Solución:

- no guardar ese PIN en Firestore accesible al cliente
- no usar PIN cliente como control real de acceso a `admin.html`
- proteger el panel con rol real y reglas reales

Ejemplo de regla:

```js
match /config/superadmin {
  allow read, write: if false;
}
```

#### 2. Los roles del usuario podrían modificarse desde el navegador si las rules no bloquean campos sensibles

Referencias:

- `shared/auth.js`
- `admin.js`

Explicación:

Existe `window.updateUserProfile(data)` que hace `updateDoc` sobre `usuarios/{uid}` sin whitelist de campos.

Si Firestore permite que el usuario escriba su propio documento, podría intentar cambiar:

- `appRoles`
- `appRol`
- `grupoEncargado`
- `matchEstado`
- `matchedPublisherId`
- `isAnonymous`
- `primerLogin`

Cómo se explotaría desde F12:

```js
await window.updateUserProfile({
  appRoles: ['admin_general'],
  appRol: 'admin_general',
  grupoEncargado: '1',
  matchEstado: 'ok'
});
```

Solución:

- permitir al usuario editar solo campos inocuos del perfil
- bloquear por rules todo campo de autorización o seguridad

Ejemplo de rules:

```js
match /usuarios/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;

  allow create: if request.auth != null && request.auth.uid == uid
    && request.resource.data.appRoles == ['publicador']
    && request.resource.data.appRol == 'publicador';

  allow update: if request.auth != null
    && request.auth.uid == uid
    && request.resource.data.diff(resource.data).changedKeys()
      .hasOnly(['displayName', 'sexo', 'birthDate', 'photoURL', 'primerLogin']);

  allow delete: if false;
}
```

#### 3. La congregación activa sale de `sessionStorage`, no del usuario autenticado

Referencias:

- `territorios/app.js`
- `hermanos/app.js`
- `asignaciones/app.js`

Explicación:

Los módulos usan `sessionStorage.congreId` para decidir qué ruta de Firestore leer y escribir.

Si las rules no verifican que el usuario pertenece a esa congregación, un atacante podría cambiar el valor en la consola y apuntar a otra congregación.

Cómo se explotaría desde F12:

```js
sessionStorage.setItem('congreId', 'otra-congregacion');
location.href = '/territorios/';
```

Solución:

- no confiar en `sessionStorage` para autorización
- validar en rules que el usuario pertenece a esa congregación

Patrón de rules:

```js
function isSameCongre(congreId) {
  return request.auth != null &&
    get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.congregacionId == congreId;
}
```

#### 4. Los PINs de módulos también están expuestos al cliente

Referencias:

- `hermanos/app.js`
- `asignaciones/app.js`
- `vida-ministerio/app.js`
- `docs/arquitectura.md`

Explicación:

`pinEncargado`, `pinVidaMinisterio` y `grupos.pin` se leen desde Firestore en el navegador.

Eso no sirve como mecanismo fuerte de seguridad frente a alguien con DevTools.

Cómo se explotaría:

- leyendo el doc de congregación o los docs de `grupos`
- inspeccionando las respuestas de Firestore
- ejecutando consultas desde consola

Solución:

- no usar PINs almacenados en Firestore cliente como control real de acceso
- reemplazarlos por roles reales o backend

### Riesgos importantes

#### 1. `anonimo` tiene acceso a casi todos los módulos

Referencias:

- `shared/auth-config.js`
- `shared/auth.js`

Explicación:

El rol `anonimo` hoy tiene acceso a varios módulos, y la protección posterior queda en PINs cliente.

Si las rules aceptan simplemente `request.auth != null`, una sesión anónima ya podría entrar.

Cómo se explotaría:

```js
await window.signInAnonymousUser();
location.href = '/hermanos/';
```

Solución:

- distinguir en rules usuario anónimo de usuario real
- no dar acceso sensible a cuentas anónimas

#### 2. El panel admin no está protegido por `authGuard('acceso_admin')`

Referencia:

- `admin.js`

Explicación:

`admin.js` importa auth, pero no exige rol admin real al entrar.

La protección está puesta en un PIN cargado desde Firestore en cliente.

Solución:

```js
import './shared/auth.js';
await window.authGuard('acceso_admin');
```

Y además rules reales del lado Firestore.

#### 3. Edición y borrado de chat dependen de estado local, no de ownership backend

Referencias:

- `territorios/app.js`
- `hermanos/app.js`

Explicación:

La UI decide si un mensaje es “mío” usando IDs guardados en `sessionStorage`, pero la operación real de editar o borrar usa solo el `docId`.

Si las rules no validan el dueño del mensaje, un atacante podría editar o borrar mensajes ajenos.

Cómo se explotaría:

```js
await window.eliminarNota('docIdDeOtro');
```

Solución:

- guardar `ownerUid` en cada mensaje
- en rules, permitir update/delete solo al dueño

Ejemplo:

```js
allow create: if request.auth != null
  && request.resource.data.ownerUid == request.auth.uid;

allow update, delete: if request.auth != null
  && resource.data.ownerUid == request.auth.uid;
```

#### 4. `scriptUrl` de Apps Script puede ejecutarse manualmente

Referencias:

- `asignaciones/app.js`
- `vida-ministerio/app.js`

Explicación:

Si un usuario puede leer `scriptUrl`, puede llamar el Apps Script manualmente sin pasar por la UI.

No se ve firma, token ni validación adicional en el cliente.

Solución:

- no exponer URLs operativas sensibles
- agregar autenticación o firma
- mover esa lógica a backend autenticado

## Cosas que están bien

- La `apiKey` pública de Firebase en `shared/firebase.js` no es un problema por sí sola.
- No se ve uso de Admin SDK en el frontend servido al navegador.
- Varias páginas sí usan `authGuard(...)`, aunque eso no reemplaza reglas reales.
- En chat de territorios se escapa HTML al renderizar, lo que ayuda contra XSS básico.

## Lo que falta para seguir

Para auditar de verdad el punto 1 y cerrar el análisis completo del backend, falta ver:

- `firestore.rules`
- `firebase.json`
- `.firebaserc`

Cuando eso esté, se puede revisar:

- si hay `allow read, write: if true`
- si `request.auth` está validado correctamente
- si el usuario queda limitado a su propio `uid`
- si puede acceder solo a su congregación
- si faltan reglas en subcolecciones
- si el cliente puede modificar campos sensibles

## Sobre Git

No parece buena idea meter este archivo en `.gitignore`.

Mejor dejarlo versionado porque:

- documenta hallazgos reales del proyecto
- sirve como checklist de endurecimiento
- permite trabajarlo punto por punto
- deja trazabilidad de lo que se corrigió

Solo convendría ignorarlo si fueras a poner secretos reales, exploits sensibles o credenciales. En su estado actual, es documentación técnica del proyecto.
