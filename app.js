/* =============================================================
   FAMILY TREE — Frontend Application
   ============================================================= */

if (typeof window === 'undefined' || typeof document === 'undefined') {
  module.exports = {};
} else {

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : '/api';

// ─── STATE ────────────────────────────────────────────────────
const state = {
  token: localStorage.getItem('ft_token'),
  user: null,
  treeId: localStorage.getItem('ft_treeId'),
  members: [],
  relations: [],
  selectedMemberId: null,
  editingMemberId: null,
  addingRelationForId: null,
  zoom: 1,
  panX: 100,
  panY: 100,
  isPanning: false,
  panStart: { x: 0, y: 0 },
  isDraggingNode: false,
  dragNodeId: null,
  dragNodeStart: { x: 0, y: 0 },
  currentView: 'tree',
};

// ─── API HELPERS ──────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) { logout(); return; }
    throw new Error(data.error || 'Ошибка сервера');
  }
  return data;
}

async function apiForm(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${state.token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
  return data;
}

// ─── TOAST ─────────────────────────────────────────────────────
function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── AUTH ─────────────────────────────────────────────────────
function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

function logout() {
  state.token = null;
  state.user = null;
  state.treeId = null;
  localStorage.removeItem('ft_token');
  localStorage.removeItem('ft_treeId');
  showAuth();
}

async function initApp() {
  if (!state.token) { showAuth(); return; }
  try {
    const data = await api('/auth/me');
    if (!data) return;
    state.user = data.user;
    state.treeId = data.treeId;
    localStorage.setItem('ft_treeId', state.treeId);
    updateUserUI();
    showApp();
    await loadTree();
  } catch {
    showAuth();
  }
}

function updateUserUI() {
  const { user } = state;
  if (!user) return;
  document.getElementById('sidebar-user-name').textContent = user.name;
  document.getElementById('sidebar-user-email').textContent = user.email;
  document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
}

// ─── AUTH FORMS ───────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    document.getElementById('login-form').classList.toggle('hidden', which !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', which !== 'register');
    document.getElementById('login-error').textContent = '';
    document.getElementById('reg-error').textContent = '';
  });
});

document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = document.getElementById(btn.dataset.target);
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
});

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!email || !password) { errEl.textContent = 'Заполните все поля'; return; }

  btn.querySelector('span').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    state.token = data.token;
    state.user = data.user;
    state.treeId = data.treeId;
    localStorage.setItem('ft_token', data.token);
    localStorage.setItem('ft_treeId', data.treeId);
    updateUserUI();
    showApp();
    await loadTree();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.querySelector('span').classList.remove('hidden');
    btn.querySelector('.btn-spinner').classList.add('hidden');
  }
}

async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');
  const btn = document.getElementById('register-btn');

  if (!name || !email || !password) { errEl.textContent = 'Заполните все поля'; return; }
  if (password.length < 8) { errEl.textContent = 'Пароль минимум 8 символов'; return; }

  btn.querySelector('span').classList.add('hidden');
  btn.querySelector('.btn-spinner').classList.remove('hidden');

  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    state.token = data.token;
    state.user = data.user;
    state.treeId = data.treeId;
    localStorage.setItem('ft_token', data.token);
    localStorage.setItem('ft_treeId', data.treeId);
    updateUserUI();
    showApp();
    await loadTree();
    toast('Добро пожаловать! Начните добавлять родственников.', 'success');
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.querySelector('span').classList.remove('hidden');
    btn.querySelector('.btn-spinner').classList.add('hidden');
  }
}

document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('register-btn').addEventListener('click', doRegister);
document.getElementById('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('logout-btn').addEventListener('click', logout);

// ─── LOAD TREE DATA ───────────────────────────────────────────
async function loadTree() {
  if (!state.treeId) return;
  try {
    const [membersData, relationsData] = await Promise.all([
      api(`/members/tree/${state.treeId}`),
      api(`/relations/tree/${state.treeId}`),
    ]);
    state.members = membersData.members || [];
    state.relations = relationsData.relations || [];
    document.getElementById('tree-name').textContent = membersData.tree?.name || 'Семейное Древо';
    document.getElementById('member-count').textContent = `${state.members.length} участников`;

    renderTreeView();
    renderListView();
    renderStatsView();
  } catch (err) {
    toast('Ошибка загрузки данных', 'error');
  }
}

// ─── NAVIGATION ───────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const view = item.dataset.view;
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.classList.add('hidden');
    });
    const vEl = document.getElementById(`view-${view}`);
    vEl.classList.add('active');
    vEl.classList.remove('hidden');
    closeDetailPanel();
  });
});

document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

// ─── TREE VIEW ────────────────────────────────────────────────
const canvas = document.getElementById('tree-canvas');
const wrapper = document.getElementById('tree-canvas-wrapper');
const svg = document.getElementById('connections-svg');
const nodesLayer = document.getElementById('nodes-layer');

function applyTransform() {
  canvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  document.getElementById('zoom-level').textContent = `${Math.round(state.zoom * 100)}%`;
}

// Pan
wrapper.addEventListener('mousedown', e => {
  if (e.target.closest('.member-node') || e.target.closest('.member-card')) return;
  if (e.button !== 0) return;
  state.isPanning = true;
  state.panStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
  wrapper.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', e => {
  if (state.isPanning && !state.isDraggingNode) {
    state.panX = e.clientX - state.panStart.x;
    state.panY = e.clientY - state.panStart.y;
    applyTransform();
  }
  if (state.isDraggingNode) {
    const member = state.members.find(m => m.id === state.dragNodeId);
    if (!member) return;
    const dx = (e.clientX - state.dragNodeStart.screenX) / state.zoom;
    const dy = (e.clientY - state.dragNodeStart.screenY) / state.zoom;
    member.x_pos = state.dragNodeStart.origX + dx;
    member.y_pos = state.dragNodeStart.origY + dy;
    const node = document.querySelector(`[data-id="${state.dragNodeId}"]`);
    if (node) {
      node.style.left = `${member.x_pos}px`;
      node.style.top = `${member.y_pos}px`;
    }
    drawConnections();
  }
});

window.addEventListener('mouseup', async () => {
  state.isPanning = false;
  wrapper.style.cursor = '';

  if (state.isDraggingNode) {
    const member = state.members.find(m => m.id === state.dragNodeId);
    if (member) {
      try {
        await api(`/members/${state.dragNodeId}/position`, {
          method: 'PATCH',
          body: JSON.stringify({ xPos: member.x_pos, yPos: member.y_pos }),
        });
      } catch { /* silent */ }
    }
    state.isDraggingNode = false;
    state.dragNodeId = null;
  }
});

// Zoom
wrapper.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  const rect = wrapper.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const newZoom = Math.max(0.2, Math.min(3, state.zoom * factor));
  state.panX = mouseX - (mouseX - state.panX) * (newZoom / state.zoom);
  state.panY = mouseY - (mouseY - state.panY) * (newZoom / state.zoom);
  state.zoom = newZoom;
  applyTransform();
}, { passive: false });

document.getElementById('zoom-in').addEventListener('click', () => {
  state.zoom = Math.min(3, state.zoom * 1.2);
  applyTransform();
});

document.getElementById('zoom-out').addEventListener('click', () => {
  state.zoom = Math.max(0.2, state.zoom / 1.2);
  applyTransform();
});

document.getElementById('zoom-fit').addEventListener('click', fitTree);

function fitTree() {
  if (state.members.length === 0) return;
  const xs = state.members.map(m => m.x_pos);
  const ys = state.members.map(m => m.y_pos);
  const minX = Math.min(...xs) - 100;
  const minY = Math.min(...ys) - 100;
  const maxX = Math.max(...xs) + 180;
  const maxY = Math.max(...ys) + 180;
  const rect = wrapper.getBoundingClientRect();
  const scaleX = rect.width / (maxX - minX);
  const scaleY = rect.height / (maxY - minY);
  state.zoom = Math.min(scaleX, scaleY, 1);
  state.panX = -minX * state.zoom + (rect.width - (maxX - minX) * state.zoom) / 2;
  state.panY = -minY * state.zoom + (rect.height - (maxY - minY) * state.zoom) / 2;
  applyTransform();
}

// Auto-layout if no positions set
function autoLayout() {
  if (state.members.length === 0) return;
  const positioned = state.members.filter(m => m.x_pos !== 0 || m.y_pos !== 0);
  if (positioned.length > 0) return;

  // Build generational layers
  const parentMap = {};
  state.relations.forEach(r => {
    if (r.relation_type === 'child') {
      if (!parentMap[r.related_member_id]) parentMap[r.related_member_id] = [];
      parentMap[r.related_member_id].push(r.member_id);
    }
  });

  const generations = {};
  const visited = new Set();

  function assignGen(memberId, gen) {
    if (visited.has(memberId)) return;
    visited.add(memberId);
    if (!generations[gen]) generations[gen] = [];
    generations[gen].push(memberId);
    const children = state.relations
      .filter(r => r.member_id === memberId && r.relation_type === 'parent')
      .map(r => r.related_member_id);
    children.forEach(c => assignGen(c, gen + 1));
  }

  // Find roots (no parents)
  const hasParent = new Set(
    state.relations
      .filter(r => r.relation_type === 'child')
      .map(r => r.member_id)
  );

  state.members.forEach(m => {
    if (!hasParent.has(m.id)) assignGen(m.id, 0);
  });

  // Assign unvisited to gen 0
  state.members.forEach(m => {
    if (!visited.has(m.id)) assignGen(m.id, 0);
  });

  const SPACING_X = 220;
  const SPACING_Y = 200;
  const START_X = 200;
  const START_Y = 150;

  Object.entries(generations).forEach(([gen, ids]) => {
    const totalW = (ids.length - 1) * SPACING_X;
    ids.forEach((id, i) => {
      const m = state.members.find(m => m.id === id);
      if (m) {
        m.x_pos = START_X + i * SPACING_X - totalW / 2 + 500;
        m.y_pos = START_Y + parseInt(gen) * SPACING_Y;
      }
    });
  });
}

function renderTreeView() {
  const emptyEl = document.getElementById('empty-tree');

  if (state.members.length === 0) {
    emptyEl.classList.remove('hidden');
    nodesLayer.innerHTML = '';
    svg.innerHTML = '';
    return;
  }

  emptyEl.classList.add('hidden');
  autoLayout();
  renderNodes();
  drawConnections();
}

function getMemberInitials(m) {
  const f = m.first_name?.charAt(0) || '';
  const l = m.last_name?.charAt(0) || '';
  return (f + l).toUpperCase() || '?';
}

function getMemberFullName(m) {
  return [m.last_name, m.first_name, m.middle_name].filter(Boolean).join(' ');
}

function getMemberYears(m) {
  const b = m.birth_date ? new Date(m.birth_date).getFullYear() : null;
  const d = m.death_date ? new Date(m.death_date).getFullYear() : null;
  if (!b && !d) return '';
  if (!m.is_alive && d) return `${b || '?'} – ${d}`;
  return b ? `р. ${b}` : '';
}

function renderNodes() {
  nodesLayer.innerHTML = '';

  state.members.forEach(m => {
    const node = document.createElement('div');
    node.className = `member-node avatar-${m.gender || 'other'}`;
    node.dataset.id = m.id;
    if (m.id === state.selectedMemberId) node.classList.add('selected');
    node.style.left = `${m.x_pos}px`;
    node.style.top = `${m.y_pos}px`;

    const isDeceased = !m.is_alive;
    const initials = getMemberInitials(m);
    const years = getMemberYears(m);

    node.innerHTML = `
      <div class="member-card ${isDeceased ? 'deceased' : ''}">
        ${isDeceased ? '<div class="deceased-badge"></div>' : ''}
        <div class="node-avatar">
          ${m.photo_url
            ? `<img src="${m.photo_url.startsWith('http') ? m.photo_url : `${window.location.origin}${m.photo_url}`}" alt="${m.first_name}" loading="lazy"/>`
            : `<span class="node-initials">${initials}</span>`
          }
        </div>
        <div class="member-name">${m.first_name}${m.last_name ? ' ' + m.last_name : ''}</div>
        ${years ? `<div class="member-years">${years}</div>` : ''}
      </div>
    `;

    // Node drag
    node.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      state.isDraggingNode = true;
      state.dragNodeId = m.id;
      state.dragNodeStart = {
        screenX: e.clientX,
        screenY: e.clientY,
        origX: m.x_pos,
        origY: m.y_pos,
      };
    });

    // Click to select / show detail
    node.addEventListener('click', e => {
      if (Math.abs(e.clientX - state.dragNodeStart.screenX) > 5) return;
      selectMember(m.id);
    });

    nodesLayer.appendChild(node);
  });
}

function drawConnections() {
  svg.innerHTML = '';
  const drawnSpouse = new Set();

  state.relations.forEach(rel => {
    const m1 = state.members.find(m => m.id === rel.member_id);
    const m2 = state.members.find(m => m.id === rel.related_member_id);
    if (!m1 || !m2) return;

    const type = rel.relation_type;
    if (type === 'child' || type === 'step_child' || type === 'adopted_child') return;
    if (type === 'grandchild') return;

    const key = [rel.member_id, rel.related_member_id].sort().join('-') + type;
    if (type === 'spouse' && drawnSpouse.has(key)) return;
    if (type === 'spouse') drawnSpouse.add(key);

    const x1 = m1.x_pos;
    const y1 = m1.y_pos;
    const x2 = m2.x_pos;
    const y2 = m2.y_pos;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let d;

    if (type === 'spouse' || type === 'sibling') {
      d = `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`;
    } else {
      // parent → child curve
      const midY = (y1 + y2) / 2;
      d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    }

    path.setAttribute('d', d);
    path.setAttribute('class', `connection-line ${type}`);
    svg.appendChild(path);
  });
}

// ─── SELECT / DETAIL PANEL ────────────────────────────────────
function selectMember(id) {
  state.selectedMemberId = id;

  // Update node classes
  document.querySelectorAll('.member-node').forEach(n => {
    n.classList.toggle('selected', n.dataset.id === id);
  });

  showDetailPanel(id);
}

async function showDetailPanel(id) {
  const member = state.members.find(m => m.id === id);
  if (!member) return;

  const panel = document.getElementById('detail-panel');
  panel.classList.remove('hidden');

  // Photo
  const photoEl = document.getElementById('detail-photo');
  if (member.photo_url) {
    photoEl.innerHTML = `<img src="${member.photo_url.startsWith('http') ? member.photo_url : `${window.location.origin}${member.photo_url}`}" alt="${member.first_name}"/>`;
  } else {
    const initials = getMemberInitials(member);
    photoEl.innerHTML = `<span style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:600;color:var(--gold)">${initials}</span>`;
  }

  // Badge
  const badge = document.getElementById('detail-badge');
  if (!member.is_alive) {
    badge.textContent = '✝';
    badge.style.background = 'var(--muted)';
    badge.style.color = 'white';
  } else {
    badge.style.background = 'var(--green)';
    badge.style.color = 'white';
    badge.textContent = '♥';
  }

  document.getElementById('detail-name').textContent = getMemberFullName(member);
  document.getElementById('detail-dates').textContent = getMemberYears(member);

  // Info section
  const infoEl = document.getElementById('detail-info');
  const infoRows = [
    ['Пол', member.gender === 'male' ? 'Мужской' : member.gender === 'female' ? 'Женский' : null],
    ['Рождение', member.birth_place || null],
    ['Профессия', member.occupation || null],
    ['Образование', member.education || null],
  ].filter(r => r[1]);

  if (infoRows.length > 0) {
    infoEl.innerHTML = `
      <h3 class="detail-section-title">Сведения</h3>
      ${infoRows.map(([label, val]) => `
        <div class="detail-info-row">
          <span class="detail-info-label">${label}</span>
          <span class="detail-info-value">${val}</span>
        </div>
      `).join('')}
    `;
    infoEl.style.display = '';
  } else {
    infoEl.style.display = 'none';
  }

  // Relations
  const myRelations = state.relations.filter(r => r.member_id === id);
  const relEl = document.getElementById('detail-relations');
  const relSection = document.getElementById('detail-relations-section');

  if (myRelations.length > 0) {
    relSection.style.display = '';
    relEl.innerHTML = myRelations.map(rel => {
      const relMember = state.members.find(m => m.id === rel.related_member_id);
      if (!relMember) return '';
      const initials = getMemberInitials(relMember);
      const typeLabel = getRelationLabel(rel.relation_type);
      return `
        <div class="detail-relation-item" onclick="selectMember('${relMember.id}')">
          <div class="detail-rel-avatar">
            ${relMember.photo_url
              ? `<img src="${relMember.photo_url.startsWith('http') ? relMember.photo_url : `${window.location.origin}${relMember.photo_url}`}" alt="${relMember.first_name}"/>`
              : initials
            }
          </div>
          <div class="detail-rel-info">
            <div class="detail-rel-name">${getMemberFullName(relMember)}</div>
            <div class="detail-rel-type">${typeLabel}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted)"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `;
    }).join('');
  } else {
    relSection.style.display = 'none';
  }

  // Bio
  const bioSection = document.getElementById('detail-bio-section');
  if (member.bio) {
    bioSection.style.display = '';
    document.getElementById('detail-bio').textContent = member.bio;
  } else {
    bioSection.style.display = 'none';
  }

  // Footer buttons
  document.getElementById('detail-edit-btn').onclick = () => openMemberModal(id);
  document.getElementById('detail-add-rel-btn').onclick = () => openRelationModal(id);
}

function closeDetailPanel() {
  document.getElementById('detail-panel').classList.add('hidden');
  state.selectedMemberId = null;
  document.querySelectorAll('.member-node').forEach(n => n.classList.remove('selected'));
}

document.getElementById('detail-close').addEventListener('click', closeDetailPanel);

function getRelationLabel(type) {
  const map = {
    parent: 'Родитель', child: 'Ребёнок', spouse: 'Супруг / Супруга',
    sibling: 'Брат / Сестра', grandparent: 'Бабушка / Дедушка',
    grandchild: 'Внук / Внучка', step_parent: 'Отчим / Мачеха',
    step_child: 'Пасынок / Падчерица', adopted_parent: 'Приёмный родитель',
    adopted_child: 'Приёмный ребёнок',
  };
  return map[type] || type;
}

// ─── MEMBER MODAL ─────────────────────────────────────────────
function openMemberModal(editId = null) {
  state.editingMemberId = editId;
  const modal = document.getElementById('member-modal');
  modal.classList.remove('hidden');
  document.getElementById('modal-title').textContent = editId ? 'Редактировать' : 'Добавить родственника';
  document.getElementById('modal-delete').classList.toggle('hidden', !editId);

  // Reset
  resetMemberForm();

  if (editId) {
    const m = state.members.find(m => m.id === editId);
    if (m) fillMemberForm(m);
  }

  // Show active tab
  showFormTab('basic');
}

function resetMemberForm() {
  ['m-first-name','m-middle-name','m-last-name','m-maiden-name','m-occupation',
   'm-education','m-birth-place','m-death-place','m-bio','m-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('m-gender').value = '';
  document.getElementById('m-birth-date').value = '';
  document.getElementById('m-death-date').value = '';
  document.getElementById('m-is-alive').checked = true;
  document.getElementById('alive-label').textContent = 'Живёт';
  document.getElementById('death-section').style.display = 'none';
  document.getElementById('modal-photo-preview').classList.add('hidden');
  document.getElementById('photo-placeholder').classList.remove('hidden');
  document.getElementById('photo-input').value = '';
  document.getElementById('modal-relations-list').innerHTML = '';
}

function fillMemberForm(m) {
  document.getElementById('m-first-name').value = m.first_name || '';
  document.getElementById('m-middle-name').value = m.middle_name || '';
  document.getElementById('m-last-name').value = m.last_name || '';
  document.getElementById('m-maiden-name').value = m.maiden_name || '';
  document.getElementById('m-gender').value = m.gender || '';
  document.getElementById('m-occupation').value = m.occupation || '';
  document.getElementById('m-education').value = m.education || '';
  document.getElementById('m-birth-date').value = m.birth_date || '';
  document.getElementById('m-birth-place').value = m.birth_place || '';
  document.getElementById('m-death-date').value = m.death_date || '';
  document.getElementById('m-death-place').value = m.death_place || '';
  document.getElementById('m-bio').value = m.bio || '';
  document.getElementById('m-notes').value = m.notes || '';

  const isAlive = !!m.is_alive;
  document.getElementById('m-is-alive').checked = isAlive;
  document.getElementById('alive-label').textContent = isAlive ? 'Живёт' : 'Умер(ла)';
  document.getElementById('death-section').style.display = isAlive ? 'none' : '';

  if (m.photo_url) {
    const img = document.getElementById('modal-photo-preview');
    img.src = m.photo_url.startsWith('http') ? m.photo_url : `${window.location.origin}${m.photo_url}`;
    img.classList.remove('hidden');
    document.getElementById('photo-placeholder').classList.add('hidden');
  }

  // Load relations for this member
  const myRels = state.relations.filter(r => r.member_id === m.id);
  const relList = document.getElementById('modal-relations-list');
  relList.innerHTML = myRels.map(rel => {
    const rm = state.members.find(mm => mm.id === rel.related_member_id);
    if (!rm) return '';
    return `
      <div class="relation-item" data-rel-id="${rel.id}">
        <span class="relation-name">${getMemberFullName(rm)}</span>
        <span class="relation-type">${getRelationLabel(rel.relation_type)}</span>
        <button class="relation-delete" onclick="deleteRelation('${rel.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
  }).join('');
}

document.getElementById('m-is-alive').addEventListener('change', e => {
  const alive = e.target.checked;
  document.getElementById('alive-label').textContent = alive ? 'Живёт' : 'Умер(ла)';
  document.getElementById('death-section').style.display = alive ? 'none' : '';
});

// Form tabs
document.querySelectorAll('.form-tab').forEach(tab => {
  tab.addEventListener('click', () => showFormTab(tab.dataset.ftab));
});

function showFormTab(tab) {
  document.querySelectorAll('.form-tab').forEach(t => t.classList.toggle('active', t.dataset.ftab === tab));
  document.querySelectorAll('.form-panel').forEach(p => {
    p.classList.toggle('hidden', p.id !== `ftab-${tab}`);
    p.classList.toggle('active', p.id === `ftab-${tab}`);
  });
}

// Photo upload
document.getElementById('photo-upload-area').addEventListener('click', () => {
  document.getElementById('photo-input').click();
});

document.getElementById('photo-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById('modal-photo-preview');
    img.src = ev.target.result;
    img.classList.remove('hidden');
    document.getElementById('photo-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

// Save member
document.getElementById('modal-save').addEventListener('click', async () => {
  const firstName = document.getElementById('m-first-name').value.trim();
  if (!firstName) { toast('Введите имя', 'error'); showFormTab('basic'); return; }

  const payload = {
    treeId: state.treeId,
    firstName,
    middleName: document.getElementById('m-middle-name').value.trim(),
    lastName: document.getElementById('m-last-name').value.trim(),
    maidenName: document.getElementById('m-maiden-name').value.trim(),
    gender: document.getElementById('m-gender').value,
    birthDate: document.getElementById('m-birth-date').value,
    birthPlace: document.getElementById('m-birth-place').value.trim(),
    deathDate: document.getElementById('m-death-date').value,
    deathPlace: document.getElementById('m-death-place').value.trim(),
    isAlive: document.getElementById('m-is-alive').checked ? 1 : 0,
    occupation: document.getElementById('m-occupation').value.trim(),
    education: document.getElementById('m-education').value.trim(),
    bio: document.getElementById('m-bio').value.trim(),
    notes: document.getElementById('m-notes').value.trim(),
  };

  try {
    let savedMember;
    if (state.editingMemberId) {
      const data = await api(`/members/${state.editingMemberId}`, {
        method: 'PUT', body: JSON.stringify(payload),
      });
      savedMember = data.member;
      const idx = state.members.findIndex(m => m.id === state.editingMemberId);
      if (idx !== -1) state.members[idx] = savedMember;
      toast('Изменения сохранены');
    } else {
      // Auto position
      const count = state.members.length;
      payload.xPos = 500 + (count % 5) * 220;
      payload.yPos = 200 + Math.floor(count / 5) * 200;
      const data = await api('/members', { method: 'POST', body: JSON.stringify(payload) });
      savedMember = data.member;
      state.members.push(savedMember);
      toast('Родственник добавлен');
    }

    // Upload photo if selected
    const photoFile = document.getElementById('photo-input').files[0];
    if (photoFile && savedMember) {
      const fd = new FormData();
      fd.append('photo', photoFile);
      try {
        const photoData = await apiForm(`/members/${savedMember.id}/photo`, fd);
        savedMember.photo_url = photoData.photoUrl;
        const idx = state.members.findIndex(m => m.id === savedMember.id);
        if (idx !== -1) state.members[idx].photo_url = photoData.photoUrl;
      } catch (err) {
        toast('Фото не загружено: ' + err.message, 'error');
      }
    }

    closeMemberModal();
    document.getElementById('member-count').textContent = `${state.members.length} участников`;
    renderTreeView();
    renderListView();
    renderStatsView();

    if (savedMember) selectMember(savedMember.id);
  } catch (err) {
    toast(err.message, 'error');
  }
});

// Delete member
document.getElementById('modal-delete').addEventListener('click', async () => {
  if (!confirm('Удалить этого родственника? Все его связи также будут удалены.')) return;
  try {
    await api(`/members/${state.editingMemberId}`, { method: 'DELETE' });
    state.members = state.members.filter(m => m.id !== state.editingMemberId);
    state.relations = state.relations.filter(r =>
      r.member_id !== state.editingMemberId && r.related_member_id !== state.editingMemberId
    );
    toast('Удалено');
    closeMemberModal();
    closeDetailPanel();
    document.getElementById('member-count').textContent = `${state.members.length} участников`;
    renderTreeView();
    renderListView();
    renderStatsView();
  } catch (err) {
    toast(err.message, 'error');
  }
});

function closeMemberModal() {
  document.getElementById('member-modal').classList.add('hidden');
  state.editingMemberId = null;
}

document.getElementById('modal-close').addEventListener('click', closeMemberModal);
document.getElementById('modal-cancel').addEventListener('click', closeMemberModal);

document.getElementById('add-member-btn').addEventListener('click', () => openMemberModal());
document.getElementById('empty-add-btn').addEventListener('click', () => openMemberModal());
document.getElementById('add-relation-btn').addEventListener('click', () => {
  if (state.editingMemberId) openRelationModal(state.editingMemberId);
});

// ─── RELATION MODAL ───────────────────────────────────────────
function openRelationModal(forMemberId) {
  state.addingRelationForId = forMemberId;
  const modal = document.getElementById('relation-modal');
  modal.classList.remove('hidden');

  const select = document.getElementById('rel-member-select');
  select.innerHTML = state.members
    .filter(m => m.id !== forMemberId)
    .map(m => `<option value="${m.id}">${getMemberFullName(m)}</option>`)
    .join('');

  document.getElementById('rel-type-select').value = 'parent';
  document.getElementById('rel-marriage-date').value = '';
  document.getElementById('rel-divorce-date').value = '';
  document.getElementById('marriage-fields').classList.add('hidden');
}

document.getElementById('rel-type-select').addEventListener('change', e => {
  document.getElementById('marriage-fields').classList.toggle('hidden', e.target.value !== 'spouse');
});

document.getElementById('rel-modal-close').addEventListener('click', () => {
  document.getElementById('relation-modal').classList.add('hidden');
});
document.getElementById('rel-modal-cancel').addEventListener('click', () => {
  document.getElementById('relation-modal').classList.add('hidden');
});

document.getElementById('rel-modal-save').addEventListener('click', async () => {
  const relatedId = document.getElementById('rel-member-select').value;
  const relationType = document.getElementById('rel-type-select').value;

  if (!relatedId) { toast('Выберите родственника', 'error'); return; }

  try {
    const data = await api('/relations', {
      method: 'POST',
      body: JSON.stringify({
        treeId: state.treeId,
        memberId: state.addingRelationForId,
        relatedMemberId: relatedId,
        relationType,
        marriageDate: document.getElementById('rel-marriage-date').value || null,
        divorceDate: document.getElementById('rel-divorce-date').value || null,
      }),
    });

    // Reload all relations
    const relData = await api(`/relations/tree/${state.treeId}`);
    state.relations = relData.relations;

    toast('Связь добавлена');
    document.getElementById('relation-modal').classList.add('hidden');
    drawConnections();

    // Refresh detail panel if open
    if (state.selectedMemberId) showDetailPanel(state.selectedMemberId);

    // Refresh modal relations if open
    if (state.editingMemberId) {
      const m = state.members.find(m => m.id === state.editingMemberId);
      if (m) {
        const myRels = state.relations.filter(r => r.member_id === m.id);
        const relList = document.getElementById('modal-relations-list');
        relList.innerHTML = myRels.map(rel => {
          const rm = state.members.find(mm => mm.id === rel.related_member_id);
          if (!rm) return '';
          return `
            <div class="relation-item" data-rel-id="${rel.id}">
              <span class="relation-name">${getMemberFullName(rm)}</span>
              <span class="relation-type">${getRelationLabel(rel.relation_type)}</span>
              <button class="relation-delete" onclick="deleteRelation('${rel.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    toast(err.message, 'error');
  }
});

async function deleteRelation(relId) {
  if (!confirm('Удалить эту связь?')) return;
  try {
    await api(`/relations/${relId}`, { method: 'DELETE' });
    state.relations = state.relations.filter(r => r.id !== relId);
    const item = document.querySelector(`[data-rel-id="${relId}"]`);
    if (item) item.remove();
    drawConnections();
    if (state.selectedMemberId) showDetailPanel(state.selectedMemberId);
    toast('Связь удалена');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Expose for inline onclick
window.deleteRelation = deleteRelation;
window.selectMember = selectMember;

// ─── LIST VIEW ────────────────────────────────────────────────
function renderListView() {
  const grid = document.getElementById('members-grid');
  const search = document.getElementById('list-search').value.toLowerCase();
  const genderFilter = document.getElementById('filter-gender').value;
  const aliveFilter = document.getElementById('filter-alive').value;

  let filtered = state.members.filter(m => {
    const name = getMemberFullName(m).toLowerCase();
    const matchSearch = !search || name.includes(search);
    const matchGender = !genderFilter || m.gender === genderFilter;
    const matchAlive = aliveFilter === '' || String(m.is_alive) === aliveFilter;
    return matchSearch && matchGender && matchAlive;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:40px">Ничего не найдено</div>';
    return;
  }

  grid.innerHTML = filtered.map(m => `
    <div class="list-card ${!m.is_alive ? 'deceased' : ''}" onclick="openFromList('${m.id}')">
      <div class="list-avatar">
        ${m.photo_url
          ? `<img src="${m.photo_url.startsWith('http') ? m.photo_url : `${window.location.origin}${m.photo_url}`}" alt="${m.first_name}"/>`
          : `<span class="node-initials">${getMemberInitials(m)}</span>`
        }
      </div>
      <div class="list-info">
        <div class="list-name">${getMemberFullName(m)}</div>
        <div class="list-meta">${getMemberYears(m) || (m.occupation || '')}</div>
      </div>
    </div>
  `).join('');
}

window.openFromList = function(id) {
  // Switch to tree view and select
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === 'tree'));
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });
  document.getElementById('view-tree').classList.add('active');
  document.getElementById('view-tree').classList.remove('hidden');
  state.currentView = 'tree';
  selectMember(id);

  // Pan to member
  const member = state.members.find(m => m.id === id);
  if (member) {
    const rect = wrapper.getBoundingClientRect();
    state.panX = rect.width / 2 - member.x_pos * state.zoom;
    state.panY = rect.height / 2 - member.y_pos * state.zoom;
    applyTransform();
  }
};

['list-search', 'filter-gender', 'filter-alive'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderListView);
  document.getElementById(id).addEventListener('change', renderListView);
});

// ─── SEARCH IN TREE ────────────────────────────────────────────
document.getElementById('search-input').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.member-node').forEach(node => {
    const member = state.members.find(m => m.id === node.dataset.id);
    if (!member) return;
    const name = getMemberFullName(member).toLowerCase();
    node.style.opacity = (!q || name.includes(q)) ? '1' : '0.2';
  });
});

// ─── STATS VIEW ───────────────────────────────────────────────
function renderStatsView() {
  const el = document.getElementById('stats-content');
  const total = state.members.length;
  const alive = state.members.filter(m => m.is_alive).length;
  const deceased = total - alive;
  const male = state.members.filter(m => m.gender === 'male').length;
  const female = state.members.filter(m => m.gender === 'female').length;
  const withPhoto = state.members.filter(m => m.photo_url).length;
  const withBio = state.members.filter(m => m.bio).length;
  const relations = state.relations.filter(r => r.relation_type !== 'child' && r.relation_type !== 'grandchild').length;

  const ages = state.members
    .filter(m => m.birth_date)
    .map(m => {
      const end = m.death_date ? new Date(m.death_date) : new Date();
      return Math.floor((end - new Date(m.birth_date)) / (365.25 * 24 * 3600 * 1000));
    })
    .filter(a => a >= 0 && a < 130);

  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;

  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-number">${total}</div>
      <div class="stat-label">Всего родственников</div>
    </div>
    <div class="stat-card green">
      <div class="stat-number">${alive}</div>
      <div class="stat-label">Живут</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${deceased}</div>
      <div class="stat-label">Умерших</div>
    </div>
    <div class="stat-card gold">
      <div class="stat-number">${male}</div>
      <div class="stat-label">Мужчин</div>
    </div>
    <div class="stat-card gold">
      <div class="stat-number">${female}</div>
      <div class="stat-label">Женщин</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${relations}</div>
      <div class="stat-label">Связей</div>
    </div>
    ${avgAge !== null ? `
    <div class="stat-card">
      <div class="stat-number">${avgAge}</div>
      <div class="stat-label">Средний возраст</div>
    </div>` : ''}
    <div class="stat-card">
      <div class="stat-number">${withPhoto}</div>
      <div class="stat-label">С фотографиями</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${withBio}</div>
      <div class="stat-label">С биографией</div>
    </div>
  `;
}

// ─── CLOSE MODALS ON OVERLAY CLICK ────────────────────────────
document.getElementById('member-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('member-modal')) closeMemberModal();
});

document.getElementById('relation-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('relation-modal')) {
    document.getElementById('relation-modal').classList.add('hidden');
  }
});

// ─── KEYBOARD SHORTCUTS ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeMemberModal();
    document.getElementById('relation-modal').classList.add('hidden');
    closeDetailPanel();
  }
  if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    openMemberModal();
  }
});

// ─── INIT ─────────────────────────────────────────────────────
applyTransform();
initApp();

}
