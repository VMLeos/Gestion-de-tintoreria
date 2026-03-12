/* ================================================
   TINTORERÍA · APP.JS
   Base de datos: Firebase Firestore
================================================ */

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ===== CONFIGURACIÓN FIREBASE =====
   Reemplaza con los datos de tu proyecto
==================================== */

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const prendasRef = collection(db, "prendas");

/* ===== ESTADO LOCAL ===== */

let _db = [];
let currentFilter = 'todos';

/* ===== INDICADOR DE SINCRONIZACIÓN ===== */

function setSyncStatus(status) {
  const el = document.getElementById('sync-indicator');
  if (!el) return;

  const map = {
    idle:    { label: '✓ Sincronizado', cls: 'sync-ok' },
    saving:  { label: '↑ Guardando…', cls: 'sync-saving'},
    loading: { label: '↓ Cargando…', cls: 'sync-saving'},
    error:   { label: '⚠ Error', cls: 'sync-error'}
  };

  const s = map[status] || map.idle;
  el.className = `sync-indicator ${s.cls}`;
  el.textContent = s.label;
}

/* ===== BASE DE DATOS ===== */

async function dbLoad() {
  setSyncStatus('loading');

  const snapshot = await getDocs(prendasRef);

  _db = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  setSyncStatus('idle');
  return _db;
}

async function dbAdd(registro) {
  setSyncStatus('saving');

  const docRef = await addDoc(prendasRef, {
    ...registro,
    creado: new Date().toISOString(),
    recolectado: false
  });

  registro.id = docRef.id;
  _db.unshift(registro);

  setSyncStatus('idle');
  return registro;
}

async function dbUpdate(id, changes) {
  setSyncStatus('saving');

  await updateDoc(doc(db, "prendas", id), changes);

  const idx = _db.findIndex(r => r.id === id);
  if (idx !== -1) _db[idx] = { ..._db[idx], ...changes };

  setSyncStatus('idle');
}

async function dbDelete(id) {
  setSyncStatus('saving');

  await deleteDoc(doc(db, "prendas", id));
  _db = _db.filter(r => r.id !== id);

  setSyncStatus('idle');
}

async function dbDeleteMany(ids) {
  setSyncStatus('saving');

  for (const id of ids) {
    await deleteDoc(doc(db, "prendas", id));
  }

  _db = _db.filter(r => !ids.includes(r.id));

  setSyncStatus('idle');
}

/* ===== NAVEGACIÓN ===== */

window.showSection = function(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`sec-${name}`).classList.add('active');
  document.getElementById(`btn-${name}`).classList.add('active');

  if (name === 'folios') renderFolios();
  if (name === 'nueva') renderRecent();
}

/* ===== FORMULARIO ===== */

window.guardarPrenda = async function() {

  const folio = document.getElementById('folio').value.trim();
  const fechaEnt = document.getElementById('fecha-entrega').value;
  const prendas = document.getElementById('prendas').value.trim();
  const costo = document.getElementById('costo').value;
  const fechaRec = document.getElementById('fecha-recoleccion').value;

  if (!folio || !fechaEnt || !prendas) {
    showToast('Completa los campos obligatorios','error');
    return;
  }

  const data = await dbLoad();

  if (data.find(r => r.folio === folio)) {
    showToast(`El folio #${folio} ya existe`,'error');
    return;
  }

  const btn = document.querySelector('.btn-primary');
  btn.disabled = true;
  btn.innerHTML = 'Guardando…';

  try {

    await dbAdd({
      folio,
      fechaEntrega: fechaEnt,
      prendas,
      costo: costo || '0',
      fechaRecoleccion: fechaRec
    });

    showToast(`Folio #${folio} guardado ✓`,'success');
    clearForm();
    renderRecent();

  } finally {

    btn.disabled = false;
    btn.innerHTML = 'Guardar Registro';

  }
}

window.clearForm = function() {

  ['folio','prendas','costo'].forEach(id => {
    document.getElementById(id).value = '';
  });

  ['fecha-entrega','fecha-recoleccion'].forEach(id => {
    document.getElementById(id).value = '';
  });

}

/* ===== LISTA RECIENTE ===== */

async function renderRecent() {

  const list = document.getElementById('recent-list');
  list.innerHTML = `<div class="empty-state">Cargando…</div>`;

  const data = (await dbLoad()).slice(0,5);

  if (!data.length) {
    list.innerHTML = `<div class="empty-state">No hay registros</div>`;
    return;
  }

  list.innerHTML = data.map(r => `
  <div class="recent-item">
  <span class="recent-badge">#${escHtml(r.folio)}</span>
  <div class="recent-info">
  <div class="recent-prendas">${escHtml(r.prendas)}</div>
  <div class="recent-date">
  Entrega: ${formatDate(r.fechaEntrega)}
  </div>
  </div>
  <span class="recent-cost">${formatCost(r.costo)}</span>
  </div>
  `).join('');

}

/* ===== FOLIOS ===== */

window.setFilter = function(f,btn){

  currentFilter = f;

  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');

  renderFolios();

}

async function renderFolios(){

  const list = document.getElementById('folios-list');
  list.innerHTML = `<div class="empty-state">Cargando…</div>`;

  let data = await dbLoad();

  if(currentFilter === 'pendiente') data = data.filter(r => !r.recolectado);
  if(currentFilter === 'recolectado') data = data.filter(r => r.recolectado);

  if(!data.length){
    list.innerHTML = `<div class="empty-state">Sin resultados</div>`;
    return;
  }

  list.innerHTML = data.map(r => `
  <div class="folio-item ${r.recolectado ? 'recolectado':''}">
  <input type="checkbox"
  ${r.recolectado ? 'checked':''}
  onchange="toggleRecolectado('${r.id}',this.checked)">

  <span class="folio-badge">#${escHtml(r.folio)}</span>

  <div class="folio-info">
  <div class="folio-folio">${escHtml(r.prendas)}</div>
  <div class="folio-date-item">
  Entrega: ${formatDate(r.fechaEntrega)}
  </div>
  </div>

  <span class="folio-cost">${formatCost(r.costo)}</span>

  <button onclick="confirmDelete('${r.id}','${r.folio}')">🗑</button>

  </div>
  `).join('');

}

window.toggleRecolectado = async function(id,checked){

  await dbUpdate(id,{recolectado:checked});
  renderFolios();

}

/* ===== ELIMINAR ===== */

window.confirmDelete = function(id,folio){

  if(!confirm(`Eliminar folio #${folio}?`)) return;

  dbDelete(id).then(()=>{
    renderFolios();
    renderRecent();
  });

}

/* ===== UTILIDADES ===== */

function formatDate(str){

  if(!str) return '—';

  const [y,m,d] = str.split('-');
  return `${d}/${m}/${y}`;

}

function formatCost(val){

  const n = parseFloat(val);

  return isNaN(n)
  ? '—'
  : n.toLocaleString('es-MX',{style:'currency',currency:'MXN'});

}

function escHtml(str){

  return String(str)
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;');

}

let toastTimer;

function showToast(msg,type=''){

  const t = document.getElementById('toast');

  t.textContent = msg;
  t.className = `toast show ${type}`;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(()=>{
    t.classList.remove('show');
  },3000);

}

/* ===== INICIALIZAR ===== */

document.addEventListener('DOMContentLoaded', () => {

  renderRecent();

});
