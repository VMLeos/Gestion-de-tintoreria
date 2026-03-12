/* ================================================
   TINTORERÍA · APP.JS
   Base de datos: Firebase Firestore (Realtime)
================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyD0ef8Klyc5Z22ecdEBfitLF97Qpk8hXxk",
    authDomain: "tintoreria-web.firebaseapp.com",
    projectId: "tintoreria-web",
    storageBucket: "tintoreria-web.firebasestorage.app",
    messagingSenderId: "236347762345",
    appId: "1:236347762345:web:6650ff685a431ed28d2bb8"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
</script>
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const prendasRef = collection(db, "prendas");

/* ===== CONFIGURACIÓN FIREBASE ===== */

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

/* ===== ESTADO ===== */

let _db = [];
let currentFilter = 'todos';

/* ===== INDICADOR DE SINCRONIZACIÓN ===== */

function setSyncStatus(status) {

  const el = document.getElementById('sync-indicator');
  if (!el) return;

  const map = {
    idle: { label: '✓ Sincronizado', cls: 'sync-ok' },
    saving: { label: '↑ Guardando…', cls: 'sync-saving' },
    loading: { label: '↓ Cargando…', cls: 'sync-saving' },
    error: { label: '⚠ Error', cls: 'sync-error' }
  };

  const s = map[status] || map.idle;

  el.className = `sync-indicator ${s.cls}`;
  el.textContent = s.label;

}

/* ===== LISTENER EN TIEMPO REAL ===== */

function startRealtimeListener() {

  setSyncStatus('loading');

  onSnapshot(prendasRef, snapshot => {

    _db = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    setSyncStatus('idle');

    renderRecent();

    if (document.getElementById('sec-folios')?.classList.contains('active')) {
      renderFolios();
    }

  }, error => {

    console.error("Firestore error:", error);
    setSyncStatus('error');

  });

}

/* ===== BASE DE DATOS ===== */

async function dbAdd(registro) {

  setSyncStatus('saving');

  await addDoc(prendasRef, {
    ...registro,
    creado: new Date().toISOString(),
    recolectado: false
  });

}

async function dbUpdate(id, changes) {

  setSyncStatus('saving');

  await updateDoc(doc(db, "prendas", id), changes);

}

async function dbDelete(id) {

  setSyncStatus('saving');

  await deleteDoc(doc(db, "prendas", id));

}

async function dbDeleteMany(ids) {

  setSyncStatus('saving');

  for (const id of ids) {
    await deleteDoc(doc(db, "prendas", id));
  }

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

    showToast('Completa los campos obligatorios', 'error');
    return;

  }

  if (_db.find(r => r.folio === folio)) {

    showToast(`El folio #${folio} ya existe`, 'error');
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

    showToast(`Folio #${folio} guardado ✓`, 'success');

    clearForm();

  } finally {

    btn.disabled = false;
    btn.innerHTML = 'Guardar Registro';

  }

}

window.clearForm = function() {

  ['folio','prendas','costo'].forEach(id=>{
    document.getElementById(id).value='';
  });

  ['fecha-entrega','fecha-recoleccion'].forEach(id=>{
    document.getElementById(id).value='';
  });

}

/* ===== LISTA RECIENTE ===== */

function renderRecent() {

  const list = document.getElementById('recent-list');

  const data = _db.slice(0,5);

  if (!data.length) {

    list.innerHTML = `<div class="empty-state">No hay registros</div>`;
    return;

  }

  list.innerHTML = data.map(r=>`

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

  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));

  btn.classList.add('active');

  renderFolios();

}

function renderFolios(){

  const list = document.getElementById('folios-list');

  let data = [..._db];

  if(currentFilter==='pendiente') data=data.filter(r=>!r.recolectado);
  if(currentFilter==='recolectado') data=data.filter(r=>r.recolectado);

  if(!data.length){

    list.innerHTML=`<div class="empty-state">Sin resultados</div>`;
    return;

  }

  list.innerHTML=data.map(r=>`

  <div class="folio-item ${r.recolectado?'recolectado':''}">

    <input type="checkbox"
      ${r.recolectado?'checked':''}
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

}

window.confirmDelete = function(id,folio){

  if(!confirm(`Eliminar folio #${folio}?`)) return;

  dbDelete(id);

}

/* ===== UTILIDADES ===== */

function formatDate(str){

  if(!str) return '—';

  const [y,m,d]=str.split('-');

  return `${d}/${m}/${y}`;

}

function formatCost(val){

  const n=parseFloat(val);

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

  const t=document.getElementById('toast');

  t.textContent=msg;

  t.className=`toast show ${type}`;

  clearTimeout(toastTimer);

  toastTimer=setTimeout(()=>{
    t.classList.remove('show');
  },3000);

}

/* ===== INICIAR APP ===== */

document.addEventListener('DOMContentLoaded',()=>{

  startRealtimeListener();

});
