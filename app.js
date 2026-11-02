const KEY = 'service_orders_claude_v4';
const STATUSES = ['на согласовании', 'в работе', 'на проверке', 'завершён', 'отменён'];
const CLS = {
  'на согласовании': 'st-a',
  'в работе': 'st-w',
  'на проверке': 'st-c',
  'завершён': 'st-f',
  'отменён': 'st-x'
};

let orders = [];
try { orders = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { orders = []; }

let filter = 'все';
let editId = null;
let lastDeleted = null;
let toastTimer = null;

const $ = id => document.getElementById(id);
const esc = s => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(orders)); } catch (e) { console.warn(e); } };
const money = n => (!n && n !== 0) ? '—' : new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—';

function daysLeft(d) {
  if (!d) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + 'T00:00:00') - t) / 864e5);
}

function addOrder() {
  const el = $('f-title');
  const title = (el?.value || '').trim();
  if (!title) { el?.focus(); return; }

  orders.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    title,
    client: ($('f-client')?.value || '').trim(),
    contact: ($('f-contact')?.value || '').trim(),
    price: parseFloat($('f-price')?.value) || 0,
    deadline: $('f-deadline')?.value || '',
    status: $('f-status')?.value || 'в работе',
    desc: ($('f-desc')?.value || '').trim(),
    createdAt: new Date().toISOString()
  });
  save(); resetForm(); render();
}

function resetForm() {
  ['f-title', 'f-client', 'f-contact', 'f-price', 'f-deadline', 'f-desc'].forEach(i => {
    const el = $(i); if (el) el.value = '';
  });
  if ($('f-status')) $('f-status').value = 'в работе';
  $('f-title')?.focus();
}

function changeStatus(id, s) {
  const o = orders.find(x => x.id === id);
  if (o) { o.status = s; save(); render(); }
}

function removeOrder(id) {
  const idx = orders.findIndex(x => x.id === id);
  if (idx === -1) return;
  lastDeleted = { order: orders[idx], idx };
  orders.splice(idx, 1);
  save(); render();
  showToast('Заказ удалён', () => {
    if (!lastDeleted) return;
    orders.splice(lastDeleted.idx, 0, lastDeleted.order);
    lastDeleted = null; save(); render();
  });
}

function showToast(msg, onUndo) {
  const t = $('toast');
  t.innerHTML = `${msg} <button type="button" id="undoBtn">Отменить</button>`;
  t.classList.add('on');
  const u = $('undoBtn');
  if (u) u.onclick = () => { onUndo(); t.classList.remove('on'); clearTimeout(toastTimer); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('on'); lastDeleted = null; }, 5000);
}

function openEdit(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;
  editId = id;
  $('e-title').value = o.title;
  $('e-client').value = o.client || '';
  $('e-contact').value = o.contact || '';
  $('e-price').value = o.price || '';
  $('e-deadline').value = o.deadline || '';
  $('e-status').value = o.status;
  $('e-desc').value = o.desc || '';
  $('overlay').classList.add('on');
}
function closeEdit() { $('overlay').classList.remove('on'); editId = null; }
function commitEdit() {
  const o = orders.find(x => x.id === editId);
  if (!o) return;
  o.title = $('e-title').value.trim() || o.title;
  o.client = $('e-client').value.trim();
  o.contact = $('e-contact').value.trim();
  o.price = parseFloat($('e-price').value) || 0;
  o.deadline = $('e-deadline').value;
  o.status = $('e-status').value;
  o.desc = $('e-desc').value.trim();
  save(); closeEdit(); render();
}

function render() {
  const active = orders.filter(o => !['завершён', 'отменён'].includes(o.status));
  const work = orders.filter(o => o.status === 'в работе');
  const income = orders.filter(o => o.status !== 'отменён').reduce((s, o) => s + (o.price || 0), 0);
  const done = orders.filter(o => o.status === 'завершён').reduce((s, o) => s + (o.price || 0), 0);

  $('stats').innerHTML = `
    <div class="stat"><b>${active.length}</b><span>Активных заказов</span></div>
    <div class="stat"><b class="acc">${work.length}</b><span>В работе</span></div>
    <div class="stat"><b>${money(income)}</b><span>Общий портфель</span></div>
    <div class="stat"><b class="acc">${money(done)}</b><span>Заработано</span></div>`;

  const q = ($('search')?.value || '').toLowerCase().trim();
  let list = orders;
  if (filter !== 'все') list = list.filter(o => o.status === filter);
  if (q) list = list.filter(o =>
    (o.title + ' ' + (o.client || '') + ' ' + (o.contact || '') + ' ' + (o.desc || '')).toLowerCase().includes(q)
  );

  list = [...list].sort((a, b) => {
    const ad = ['завершён', 'отменён'].includes(a.status) ? 1 : 0;
    const bd = ['завершён', 'отменён'].includes(b.status) ? 1 : 0;
    if (ad !== bd) return ad - bd;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const box = $('orders');
  if (!list.length) {
    box.innerHTML = `<div class="empty">
      <div class="ic">◌</div>
      <h3>${orders.length ? 'Ничего не найдено' : 'Пока нет заказов'}</h3>
      <p>${orders.length ? 'Измени фильтр или запрос.' : 'Добавь первый заказ через форму выше.'}</p>
    </div>`;
    return;
  }

  box.innerHTML = list.map(o => {
    const dl = daysLeft(o.deadline);
    let dc = '', dt = '';
    if (o.deadline) {
      if (['завершён', 'отменён'].includes(o.status)) dt = fmtD(o.deadline);
      else if (dl < 0) { dc = 'over'; dt = fmtD(o.deadline) + ' · просрочен'; }
      else if (dl <= 2) { dc = 'soon'; dt = fmtD(o.deadline) + ' · ' + (dl === 0 ? 'сегодня' : dl + ' дн.'); }
      else dt = fmtD(o.deadline);
    }
    const extra = o.status === 'завершён' ? 'done' : o.status === 'отменён' ? 'cancel' : '';

    return `<div class="order ${CLS[o.status] || ''} ${extra}">
      <div class="otop">
        <div class="title">${esc(o.title)}</div>
        <div class="price">${money(o.price)}</div>
      </div>
      <div class="meta">
        <span class="pill">${o.status}</span>
        ${o.client ? `<span>Клиент: <b>${esc(o.client)}</b></span>` : ''}
        ${o.contact ? `<span>${esc(o.contact)}</span>` : ''}
        ${o.deadline ? `<span class="${dc}">Дедлайн: <b>${dt}</b></span>` : ''}
      </div>
      ${o.desc ? `<div class="desc">${esc(o.desc)}</div>` : ''}
      <div class="actions">
        <select data-action="status" data-id="${o.id}">
          ${STATUSES.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="mini" data-action="edit" data-id="${o.id}">Изменить</button>
        <button class="mini d" data-action="delete" data-id="${o.id}">Удалить</button>
      </div>
    </div>`;
  }).join('');
}

$('orders').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const a = btn.dataset.action;
  if (a === 'delete') removeOrder(id);
  if (a === 'edit') openEdit(id);
});

$('orders').addEventListener('change', e => {
  const sel = e.target.closest('select[data-action="status"]');
  if (!sel) return;
  changeStatus(Number(sel.dataset.id), sel.value);
});

$('addBtn').addEventListener('click', addOrder);
$('resetBtn').addEventListener('click', resetForm);
$('saveEdit').addEventListener('click', commitEdit);
$('cancelEdit').addEventListener('click', closeEdit);
$('overlay').addEventListener('click', e => { if (e.target === $('overlay')) closeEdit(); });
$('search').addEventListener('input', render);

document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  filter = b.dataset.f;
  render();
}));

['f-title', 'f-client', 'f-contact'].forEach(id =>
  $(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addOrder(); }
  })
);

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEdit(); });

render();