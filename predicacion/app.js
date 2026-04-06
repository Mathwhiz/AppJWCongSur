import { db } from '../shared/firebase.js';
import '../shared/auth.js';
import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// ─────────────────────────────────────────
//   HELPERS
// ─────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function mesHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function navearMes(iso, delta) {
  const [y, m] = iso.split('-').map(Number);
  let nm = m + delta, ny = y;
  if (nm > 12) { nm = 1;  ny++; }
  if (nm < 1)  { nm = 12; ny--; }
  return `${ny}-${String(nm).padStart(2,'0')}`;
}

function fmtMes(iso) {
  const [y, m] = iso.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

function fmtTiempo(mins) {
  if (!mins || mins <= 0) return '0 min';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function toast(msg, type = 'success') {
  if (window.uiToast) window.uiToast(msg, type);
}

// ─────────────────────────────────────────
//   ESTADO — declarado antes del await
// ─────────────────────────────────────────
let _uid         = '';
let _mesMostrado = mesHoy();
let _dataMes     = { minutos: 0, revisitas: 0, estudios: 0 };
let _mesExiste   = false;  // si hay doc en Firestore para el mes actual

// Timer
let _timerInterval = null;
let _timerStart    = 0;
let _timerAccum    = 0;
let _timerRunning  = false;

// Debounce
let _saveTimeout = null;
function scheduleSave() {
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(guardarMes, 600);
}

// Estado modal contacto
let _contactoTipo = 'revisita';   // 'revisita' | 'estudio'
let _contactoId   = null;         // null = nuevo, string = editar

// ─────────────────────────────────────────
//   AUTH CHECK
// ─────────────────────────────────────────
const _user = await window.waitForAuth();

if (!_user || _user.isAnonymous) {
  showView('view-noauth');
} else {
  init(_user.uid);
}

// ─────────────────────────────────────────
//   INIT
// ─────────────────────────────────────────
async function init(uid) {
  _uid = uid;
  showView('view-app');
  renderMonthLabel();
  await cargarMes();
  cargarHistorial();
  cargarContactos('revisita');
  cargarContactos('estudio');
}

// ─────────────────────────────────────────
//   TABS
// ─────────────────────────────────────────
window.switchTab = function(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`tab-btn-${tab}`).classList.add('active');
};

// ─────────────────────────────────────────
//   FIRESTORE — MES
// ─────────────────────────────────────────
function mesRef(mes) {
  return doc(db, 'usuarios', _uid, 'predicacion', mes);
}

async function cargarMes() {
  const snap = await getDoc(mesRef(_mesMostrado));
  _mesExiste = snap.exists();
  _dataMes   = _mesExiste
    ? { minutos: 0, revisitas: 0, estudios: 0, ...snap.data() }
    : { minutos: 0, revisitas: 0, estudios: 0 };
  renderStats();
}

async function guardarMes() {
  _mesExiste = true;
  await setDoc(mesRef(_mesMostrado), {
    minutos:   _dataMes.minutos   || 0,
    revisitas: _dataMes.revisitas || 0,
    estudios:  _dataMes.estudios  || 0,
    updatedAt: serverTimestamp(),
  });
}

async function cargarHistorial() {
  const cont = document.getElementById('hist-container');
  try {
    const ref  = collection(db, 'usuarios', _uid, 'predicacion');
    const snap = await getDocs(ref);
    const hoy  = mesHoy();
    const meses = [];
    snap.forEach(d => {
      if (d.id < hoy) meses.push({ id: d.id, ...d.data() });
    });
    meses.sort((a, b) => b.id.localeCompare(a.id));
    renderHistorial(meses);
  } catch {
    cont.innerHTML = '<div class="hist-empty">Error al cargar el historial</div>';
  }
}

// ─────────────────────────────────────────
//   FIRESTORE — CONTACTOS
// ─────────────────────────────────────────
function contactosRef(tipo) {
  // 'revisita' → 'revisitas', 'estudio' → 'estudios'
  return collection(db, 'usuarios', _uid, tipo === 'revisita' ? 'revisitas' : 'estudios');
}

function contactoDocRef(tipo, id) {
  const col = tipo === 'revisita' ? 'revisitas' : 'estudios';
  return doc(db, 'usuarios', _uid, col, id);
}

async function cargarContactos(tipo) {
  const listEl = document.getElementById(tipo === 'revisita' ? 'revisitas-list' : 'estudios-list');
  try {
    const snap = await getDocs(contactosRef(tipo));
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    renderContactos(tipo, items);
  } catch {
    listEl.innerHTML = '<div class="hist-empty">Error al cargar</div>';
  }
}

// ─────────────────────────────────────────
//   RENDER
// ─────────────────────────────────────────
function renderMonthLabel() {
  document.getElementById('month-label').textContent = fmtMes(_mesMostrado);
  document.getElementById('month-next-btn').disabled = (_mesMostrado >= mesHoy());
}

function renderStats() {
  const sinActividad = !_mesExiste ||
    ((_dataMes.minutos || 0) === 0 && (_dataMes.revisitas || 0) === 0 && (_dataMes.estudios || 0) === 0);

  document.getElementById('mes-vacio').style.display  = sinActividad ? '' : 'none';
  document.getElementById('mes-stats').style.display  = sinActividad ? 'none' : '';

  if (!sinActividad) {
    document.getElementById('stat-tiempo').textContent    = fmtTiempo(_dataMes.minutos);
    document.getElementById('stat-revisitas').textContent = _dataMes.revisitas || 0;
    document.getElementById('stat-estudios').textContent  = _dataMes.estudios  || 0;
  }
}

function renderHistorial(meses) {
  const cont = document.getElementById('hist-container');
  if (!meses.length) {
    cont.innerHTML = '<div class="hist-empty">Sin meses anteriores registrados</div>';
    return;
  }
  const filas = meses.map(m => `
    <div class="hist-row">
      <span class="hist-mes">${fmtMes(m.id)}</span>
      <span class="hist-val">${fmtTiempo(m.minutos || 0)}</span>
      <span class="hist-val">${m.revisitas || 0} <span class="hist-val-dim">rev</span></span>
      <span class="hist-val">${m.estudios  || 0} <span class="hist-val-dim">est</span></span>
    </div>
  `).join('');
  cont.innerHTML = `
    <div class="hist-card">
      <div class="hist-header">
        <span class="hist-header-cell">Mes</span>
        <span class="hist-header-cell">Tiempo</span>
        <span class="hist-header-cell">Rev</span>
        <span class="hist-header-cell">Est</span>
      </div>
      ${filas}
    </div>`;
}

function renderContactos(tipo, items) {
  const listEl = document.getElementById(tipo === 'revisita' ? 'revisitas-list' : 'estudios-list');
  if (!items.length) {
    const txt = tipo === 'revisita' ? 'Sin revisitas registradas' : 'Sin estudios registrados';
    listEl.innerHTML = `<div class="contact-card"><div class="contact-empty">${txt}</div></div>`;
    return;
  }
  const filas = items.map(item => `
    <div class="contact-item" onclick="abrirContacto('${tipo}', '${item.id}')">
      <div class="contact-item-info">
        <div class="contact-item-nombre">${esc(item.nombre)}</div>
        ${item.notas ? `<div class="contact-item-notas">${esc(item.notas)}</div>` : ''}
      </div>
      <button class="contact-item-del"
        onclick="event.stopPropagation(); eliminarContacto('${tipo}', '${item.id}', '${esc(item.nombre)}')"
        title="Eliminar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.7"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `).join('');
  listEl.innerHTML = `<div class="contact-card">${filas}</div>`;
}

// ─────────────────────────────────────────
//   NAVEGACIÓN DE MES
// ─────────────────────────────────────────
window.navMes = async function(delta) {
  _mesMostrado = navearMes(_mesMostrado, delta);
  renderMonthLabel();
  await cargarMes();
};

// ─────────────────────────────────────────
//   CONTADORES +/−
// ─────────────────────────────────────────
window.cambiarContador = function(campo, delta) {
  _dataMes[campo] = Math.max(0, (_dataMes[campo] || 0) + delta);
  _mesExiste = true;
  renderStats();
  scheduleSave();
};

// ─────────────────────────────────────────
//   EDITAR TIEMPO
// ─────────────────────────────────────────
window.abrirEditTiempo = function() {
  const mins = _dataMes.minutos || 0;
  document.getElementById('edit-horas').value = Math.floor(mins / 60) || '';
  document.getElementById('edit-mins').value  = mins % 60 || '';
  document.getElementById('modal-edit-tiempo').style.display = 'flex';
  setTimeout(() => document.getElementById('edit-horas').focus(), 60);
};

window.cerrarEditTiempo = function() {
  document.getElementById('modal-edit-tiempo').style.display = 'none';
};

window.guardarEditTiempo = async function() {
  const h = Math.max(0, parseInt(document.getElementById('edit-horas').value) || 0);
  const m = Math.max(0, Math.min(59, parseInt(document.getElementById('edit-mins').value) || 0));
  _dataMes.minutos = h * 60 + m;
  _mesExiste = true;
  renderStats();
  cerrarEditTiempo();
  await guardarMes();
  toast(`Tiempo actualizado: ${fmtTiempo(_dataMes.minutos)}`);
};

// ─────────────────────────────────────────
//   AGREGAR TIEMPO MANUAL
// ─────────────────────────────────────────
window.abrirAgregarTiempo = function() {
  document.getElementById('add-horas').value = '';
  document.getElementById('add-mins').value  = '';
  document.getElementById('modal-add-tiempo').style.display = 'flex';
  setTimeout(() => document.getElementById('add-horas').focus(), 60);
};

window.cerrarAgregarTiempo = function() {
  document.getElementById('modal-add-tiempo').style.display = 'none';
};

window.guardarAgregarTiempo = async function() {
  const h = Math.max(0, parseInt(document.getElementById('add-horas').value) || 0);
  const m = Math.max(0, Math.min(59, parseInt(document.getElementById('add-mins').value) || 0));
  const mins = h * 60 + m;
  if (mins < 1) { toast('Ingresá al menos 1 minuto', 'error'); return; }
  _dataMes.minutos = (_dataMes.minutos || 0) + mins;
  _mesExiste = true;
  renderStats();
  cerrarAgregarTiempo();
  await guardarMes();
  toast(`${fmtTiempo(mins)} agregados a ${fmtMes(_mesMostrado)}`);
};

// ─────────────────────────────────────────
//   CONTACTOS — CRUD
// ─────────────────────────────────────────
window.abrirContacto = async function(tipo, id) {
  _contactoTipo = tipo;
  _contactoId   = id;

  const titulo = id
    ? (tipo === 'revisita' ? 'Editar revisita' : 'Editar estudio')
    : (tipo === 'revisita' ? 'Nueva revisita'  : 'Nuevo estudio');
  document.getElementById('modal-contacto-title').textContent = titulo;

  if (id) {
    const snap = await getDoc(contactoDocRef(tipo, id));
    const data = snap.exists() ? snap.data() : {};
    document.getElementById('contacto-nombre').value = data.nombre || '';
    document.getElementById('contacto-notas').value  = data.notas  || '';
  } else {
    document.getElementById('contacto-nombre').value = '';
    document.getElementById('contacto-notas').value  = '';
  }

  document.getElementById('modal-contacto').style.display = 'flex';
  setTimeout(() => document.getElementById('contacto-nombre').focus(), 60);
};

window.cerrarContacto = function() {
  document.getElementById('modal-contacto').style.display = 'none';
};

window.guardarContacto = async function() {
  const nombre = document.getElementById('contacto-nombre').value.trim();
  const notas  = document.getElementById('contacto-notas').value.trim();
  if (!nombre) { toast('Ingresá un nombre', 'error'); return; }

  const data = { nombre, notas, updatedAt: serverTimestamp() };

  if (_contactoId) {
    await updateDoc(contactoDocRef(_contactoTipo, _contactoId), data);
  } else {
    data.creadoEn = serverTimestamp();
    await addDoc(contactosRef(_contactoTipo), data);
  }

  cerrarContacto();
  toast(_contactoId ? 'Guardado' : 'Agregado');
  cargarContactos(_contactoTipo);
};

window.eliminarContacto = async function(tipo, id, nombre) {
  const ok = await window.uiConfirm({
    title: 'Eliminar',
    msg: `¿Eliminar a ${nombre}?`,
    confirmText: 'Eliminar',
    type: 'danger',
  });
  if (!ok) return;
  await deleteDoc(contactoDocRef(tipo, id));
  toast('Eliminado');
  cargarContactos(tipo);
};

// ─────────────────────────────────────────
//   CRONÓMETRO
// ─────────────────────────────────────────
function timerElapsedMs() {
  return _timerAccum + (_timerRunning ? Date.now() - _timerStart : 0);
}

function fmtTimer(ms) {
  const s = Math.floor(ms / 1000);
  return [
    String(Math.floor(s / 3600)).padStart(2, '0'),
    String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
    String(s % 60).padStart(2, '0'),
  ].join(':');
}

function tickTimer() {
  const ms   = timerElapsedMs();
  const mins = Math.floor(ms / 60000);
  document.getElementById('timer-display').textContent = fmtTimer(ms);
  const wrap = document.getElementById('timer-add-wrap');
  const btn  = document.getElementById('timer-add-btn');
  if (ms > 0) {
    wrap.style.display = '';
    btn.textContent = mins >= 1 ? `+ Agregar ${mins} min al mes` : '+ Agregar al mes';
  } else {
    wrap.style.display = 'none';
  }
}

window.timerToggle = function() {
  const toggleBtn = document.getElementById('timer-toggle-btn');
  const display   = document.getElementById('timer-display');
  if (!_timerRunning) {
    _timerRunning  = true;
    _timerStart    = Date.now();
    _timerInterval = setInterval(tickTimer, 1000);
    toggleBtn.textContent = 'Pausar';
    display.classList.add('running');
  } else {
    _timerAccum  += Date.now() - _timerStart;
    _timerRunning = false;
    clearInterval(_timerInterval);
    _timerInterval = null;
    toggleBtn.textContent = 'Continuar';
    display.classList.remove('running');
    tickTimer();
  }
};

window.timerReset = function() {
  _timerRunning = false;
  clearInterval(_timerInterval);
  _timerInterval = null;
  _timerAccum    = 0;
  _timerStart    = 0;
  document.getElementById('timer-display').textContent = '00:00:00';
  document.getElementById('timer-display').classList.remove('running');
  document.getElementById('timer-toggle-btn').textContent = 'Iniciar';
  document.getElementById('timer-add-wrap').style.display = 'none';
};

window.timerAgregarAlMes = async function() {
  const ms   = timerElapsedMs();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) { toast('Menos de 1 minuto registrado', 'error'); return; }
  _dataMes.minutos = (_dataMes.minutos || 0) + mins;
  _mesExiste = true;
  renderStats();
  timerReset();
  await guardarMes();
  toast(`${fmtTiempo(mins)} agregados al mes`);
};
