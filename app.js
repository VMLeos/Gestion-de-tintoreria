/* ================================================
   TINTORERÍA · APP.JS
   Base de datos: GitHub API (db.json en el repo)
   Google Calendar: enlace manual (sin OAuth)
================================================ */

// ---- CONFIGURACIÓN GITHUB ----
// Edita estos valores con los de tu repositorio:
const GH_CONFIG = {
  owner: 'VMLeos',       // tu usuario de GitHub
  repo:  'tintoreria-app',   // nombre del repositorio
  token: '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',  // Personal Access Token (ver README)
  file:  'db.json'           // archivo de base de datos
};

const GH_API = `https://api.github.com/repos/${GH_CONFIG.owner}/${GH_CONFIG.repo}/contents/${GH_CONFIG.file}`;

// ---- ESTADO LOCAL (caché) ----
let _db    = null;   // array de registros
let _sha   = null;   // SHA del archivo en GitHub (requerido para actualizar)
let _dirty = false;  // hay cambios pendientes de guardar

// ---- INDICADOR DE SINCRONIZACIÓN ----
function setSyncStatus(status) {
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  const map = {
    idle:    { label: '✓ Guardado',   cls: 'sync-ok'    },
    saving:  { label: '↑ Guardando…', cls: 'sync-saving'},
    loading: { label: '↓ Cargando…',  cls: 'sync-saving'},
    error:   { label: '⚠ Sin sync',   cls: 'sync-error' }
  };
  const s = map[status] || map.idle;
  el.className  = `sync-indicator ${s.cls}`;
  el.textContent = s.label;
}

// ---- BASE DE DATOS: GITHUB API ----

async function dbLoad() {
  if (_db !== null) return _db;

  setSyncStatus('loading');
  try {
    const res = await fetch(GH_API, {
      headers: {
        'Authorization': `Bearer ${GH_CONFIG.token}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (res.status === 404) {
      _db = []; _sha = null;
      setSyncStatus('idle');
      return _db;
    }

    if (!res.ok) throw new Error(`GitHub ${res.status}`);

    const json = await res.json();
    _sha = json.sha;
    _db  = JSON.parse(atob(json.content.replace(/\n/g, '')));
    setSyncStatus('idle');
    return _db;

  } catch (err) {
    console.error('Error cargando DB:', err);
    setSyncStatus('error');
    try { _db = JSON.parse(localStorage.getItem('tintoreria_db')) || []; }
    catch { _db = []; }
    return _db;
  }
}

async function dbCommit() {
  if (!_dirty) return;
  setSyncStatus('saving');

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(_db, null, 2))));
  const body = {
    message: `update: ${new Date().toISOString().slice(0,10)}`,
    content,
    ...(_sha ? { sha: _sha } : {})
  };

  try {
    const res = await fetch(GH_API, {
      method:  'PUT',
      headers: {
        'Authorization': `Bearer ${GH_CONFIG.token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/vnd.github+json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.message || res.status);
    }

    const json = await res.json();
    _sha   = json.content.sha;
    _dirty = false;
    localStorage.setItem('tintoreria_db', JSON.stringify(_db));
    setSyncStatus('idle');

  } catch (err) {
    console.error('Error guardando DB:', err);
    setSyncStatus('error');
    showToast('Error al sincronizar con GitHub ⚠', 'error');
    localStorage.setItem('tintoreria_db', JSON.stringify(_db));
  }
}

async function dbAdd(registro) {
  await dbLoad();
  registro.id = Date.now().toString();
  registro.creado = new Date().toISOString();
  registro.recolectado = false;
  _db.unshift(registro);
  _dirty = true;
  await dbCommit();
  return registro;
}

async function dbUpdate(id, changes) {
  await dbLoad();
  const idx = _db.findIndex(r => r.id === id);
  if (idx !== -1) { _db[idx] = { ..._db[idx], ...changes }; _dirty = true; await dbCommit(); }
}

async function dbDelete(id) {
  await dbLoad();
  _db = _db.filter(r => r.id !== id);
  _dirty = true;
  await dbCommit();
}

async function dbDeleteMany(ids) {
  await dbLoad();
  _db = _db.filter(r => !ids.includes(r.id));
  _dirty = true;
  await dbCommit();
}

function dbInvalidate() { _db = null; _sha = null; }

// ---- ESTADO UI ----
let currentFilter = 'todos';

// ---- NAVEGACIÓN ----
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`sec-${name}`).classList.add('active');
  document.getElementById(`btn-${name}`).classList.add('active');
  if (name === 'folios') renderFolios();
  if (name === 'nueva')  renderRecent();
}

// ---- FORMULARIO ----
async function guardarPrenda() {
  const folio    = document.getElementById('folio').value.trim();
  const fechaEnt = document.getElementById('fecha-entrega').value;
  const prendas  = document.getElementById('prendas').value.trim();
  const costo    = document.getElementById('costo').value;
  const fechaRec = document.getElementById('fecha-recoleccion').value;

  if (!folio || !fechaEnt || !prendas) {
    showToast('Completa los campos obligatorios', 'error');
    return;
  }

  const data = await dbLoad();
  if (data.find(r => r.folio === folio)) {
    showToast(`El folio #${folio} ya existe`, 'error');
    return;
  }

  const btn = document.querySelector('.btn-primary');
  btn.disabled = true;
  btn.innerHTML = '↑ Guardando…';

  try {
    await dbAdd({ folio, fechaEntrega: fechaEnt, prendas, costo: costo || '0', fechaRecoleccion: fechaRec });
    showToast(`Folio #${folio} guardado ✓`, 'success');
    clearForm();
    renderRecent();
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Guardar Registro`;
  }
}

function clearForm() {
  ['folio','prendas','costo'].forEach(id => document.getElementById(id).value = '');
  ['fecha-entrega','fecha-recoleccion'].forEach(id => document.getElementById(id).value = '');
}

// ---- LISTA RECIENTE ----
async function renderRecent() {
  const list = document.getElementById('recent-list');
  list.innerHTML = `<div class="empty-state"><span class="empty-icon">⟳</span> Cargando…</div>`;
  const data = (await dbLoad()).slice(0, 5);

  if (data.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">🧺</span>No hay registros aún</div>`;
    return;
  }

  list.innerHTML = data.map(r => `
    <div class="recent-item">
      <span class="recent-badge">#${escHtml(r.folio)}</span>
      <div class="recent-info">
        <div class="recent-prendas">${escHtml(r.prendas)}</div>
        <div class="recent-date">
          Entrega: ${formatDate(r.fechaEntrega)}
          ${r.fechaRecoleccion ? ' · Recol.: ' + formatDate(r.fechaRecoleccion) : ''}
        </div>
      </div>
      <span class="recent-cost">${formatCost(r.costo)}</span>
    </div>`).join('');
}

// ---- FOLIOS ----
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderFolios();
}

async function renderFolios() {
  const list = document.getElementById('folios-list');
  list.innerHTML = `<div class="empty-state"><span class="empty-icon">⟳</span> Cargando…</div>`;

  const search = (document.getElementById('search-folio')?.value || '').toLowerCase();
  let data = await dbLoad();

  const total        = data.length;
  const recolectados = data.filter(r => r.recolectado).length;
  document.getElementById('folios-stats').innerHTML = `
    <div class="stat-pill">
      <div class="stat-num">${total}</div>
      <div class="stat-label">Total</div>
    </div>
    <div class="stat-pill success">
      <div class="stat-num">${recolectados}</div>
      <div class="stat-label">Listos</div>
    </div>`;

  if (currentFilter === 'pendiente')   data = data.filter(r => !r.recolectado);
  if (currentFilter === 'recolectado') data = data.filter(r =>  r.recolectado);
  if (search) data = data.filter(r =>
    r.folio.toLowerCase().includes(search) ||
    r.prendas.toLowerCase().includes(search)
  );

  if (data.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">🔍</span>Sin resultados</div>`;
    return;
  }

  list.innerHTML = data.map(r => `
    <div class="folio-item ${r.recolectado ? 'recolectado' : ''}" id="fi-${r.id}">
      <input type="checkbox" class="folio-check" ${r.recolectado ? 'checked' : ''}
        onchange="toggleRecolectado('${r.id}', this.checked)" title="Marcar como recolectado"/>
      <span class="folio-badge">#${escHtml(r.folio)}</span>
      <div class="folio-info">
        <div class="folio-folio">${escHtml(r.prendas)}</div>
        <div class="folio-dates">
          <span class="folio-date-item">📅 Entrega: ${formatDate(r.fechaEntrega)}</span>
          ${r.fechaRecoleccion ? `
          <span class="folio-date-item">
            <a class="gcal-link" href="${buildCalendarURL(r)}" target="_blank">
              🗓 Recolección: ${formatDate(r.fechaRecoleccion)} ↗
            </a>
          </span>` : ''}
        </div>
      </div>
      <span class="folio-cost">${formatCost(r.costo)}</span>
      <div class="folio-actions">
        <button class="folio-btn" onclick="confirmDelete('${r.id}', '${escHtml(r.folio)}')" title="Eliminar">
          <svg viewBox="0 0 18 18" fill="none"><path d="M4 5h10M7 5V3h4v2M6 5l.5 10H11.5L12 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>`).join('');
}

async function toggleRecolectado(id, checked) {
  await dbUpdate(id, { recolectado: checked });
  dbInvalidate();
  await renderFolios();
  showToast(checked ? 'Marcado como recolectado ✓' : 'Marcado como pendiente', checked ? 'success' : '');
}

function confirmDelete(id, folio) {
  openModal('Eliminar Folio',
    `¿Deseas eliminar el folio #${folio}? Esta acción no se puede deshacer.`,
    async () => {
      await dbDelete(id);
      dbInvalidate();
      await renderFolios();
      await renderRecent();
      showToast(`Folio #${folio} eliminado`, '');
      closeModal();
    });
}

async function borrarRecolectados() {
  const data = await dbLoad();
  const rec  = data.filter(r => r.recolectado);
  if (rec.length === 0) { showToast('No hay folios recolectados para borrar', 'error'); return; }

  openModal('Borrar Recolectados',
    `Se eliminarán ${rec.length} folio(s) marcados como recolectados. ¿Continuar?`,
    async () => {
      await dbDeleteMany(rec.map(r => r.id));
      dbInvalidate();
      await renderFolios();
      await renderRecent();
      showToast(`${rec.length} folio(s) eliminados`, '');
      closeModal();
    });
}

// ---- GOOGLE CALENDAR (enlace manual) ----
function buildCalendarURL(r) {
  if (!r.fechaRecoleccion) return '#';
  const d0  = r.fechaRecoleccion.replace(/-/g, '');
  const d1  = getNextDay(r.fechaRecoleccion);
  const txt = encodeURIComponent(`Recolectar Tintorería · Folio #${r.folio}`);
  const det = encodeURIComponent(`Prendas: ${r.prendas}\nCosto: ${formatCost(r.costo)}\nEntrega: ${formatDate(r.fechaEntrega)}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${txt}&dates=${d0}/${d1}&details=${det}`;
}

function getNextDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0,10).replace(/-/g,'');
}

// ---- EXPORTAR CSV ----
async function exportarCSV() {
  const data = await dbLoad();
  if (!data.length) { showToast('No hay datos para exportar', 'error'); return; }

  const rows = [
    ['Folio','Fecha Entrega','Prendas','Costo','Fecha Recolección','Recolectado'],
    ...data.map(r => [r.folio, r.fechaEntrega, `"${r.prendas.replace(/"/g,'""')}"`, r.costo, r.fechaRecoleccion||'', r.recolectado?'Sí':'No'])
  ];

  const blob = new Blob(['\uFEFF' + rows.map(r=>r.join(',')).join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `tintoreria_${new Date().toISOString().slice(0,10)}.csv`
  });
  a.click();
  showToast('CSV exportado ✓', 'success');
}

// ---- MODAL ----
function openModal(title, msg, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-msg').textContent   = msg;
  document.getElementById('modal').classList.add('open');
  document.getElementById('modal-confirm').onclick   = onConfirm;
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }

// ---- TOAST ----
let _toastTimer;
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer   = setTimeout(()=>t.classList.remove('show'), 3400);
}

// ---- HELPERS ----
function formatDate(str) {
  if (!str) return '—';
  const [y,m,d] = str.split('-');
  return `${d}/${m}/${y}`;
}
function formatCost(val) {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : n.toLocaleString('es-MX',{style:'currency',currency:'MXN'});
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ---- INICIALIZAR ----
document.addEventListener('DOMContentLoaded', () => {
  renderRecent();
  document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });
});
