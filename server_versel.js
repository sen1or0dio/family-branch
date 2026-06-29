const createState = () => ({
  users: [
    {
      id: 1,
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'demo12345',
      treeId: 'default',
    },
  ],
  sessions: new Map(),
  trees: {
    default: {
      id: 'default',
      name: 'Семейное древо',
      members: [],
      relations: [],
    },
  },
});

const state = globalThis.__familyTreeState || (globalThis.__familyTreeState = createState());

function seedDemoTree() {
  const tree = state.trees.default;
  if (tree.members.length > 0) return;

  tree.members.push({
    id: 'm1',
    first_name: 'Иван',
    last_name: 'Петров',
    middle_name: '',
    maiden_name: '',
    gender: 'male',
    birth_date: '1960-01-01',
    birth_place: 'Москва',
    death_date: '',
    death_place: '',
    occupation: 'Инженер',
    education: 'Высшее',
    bio: 'Основатель древа',
    notes: '',
    is_alive: 1,
    x_pos: 500,
    y_pos: 200,
    photo_url: null,
  });

  tree.members.push({
    id: 'm2',
    first_name: 'Мария',
    last_name: 'Петрова',
    middle_name: '',
    maiden_name: '',
    gender: 'female',
    birth_date: '1962-03-15',
    birth_place: 'Санкт-Петербург',
    death_date: '',
    death_place: '',
    occupation: 'Учитель',
    education: 'Высшее',
    bio: 'Мама и хранительница памяти',
    notes: '',
    is_alive: 1,
    x_pos: 720,
    y_pos: 200,
    photo_url: null,
  });

  tree.relations.push({
    id: 'r1',
    member_id: 'm1',
    related_member_id: 'm2',
    relation_type: 'spouse',
  });
}

seedDemoTree();

function createToken() {
  return `token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getUserByToken(token) {
  const userId = state.sessions.get(token);
  if (!userId) return null;
  return state.users.find(user => user.id === userId) || null;
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

function getTree(treeId) {
  return state.trees[treeId] || state.trees.default;
}

function normalizeMember(body, overrides = {}) {
  return {
    id: overrides.id || `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    first_name: body.firstName || body.first_name || '',
    last_name: body.lastName || body.last_name || '',
    middle_name: body.middleName || body.middle_name || '',
    maiden_name: body.maidenName || body.maiden_name || '',
    gender: body.gender || '',
    birth_date: body.birthDate || body.birth_date || '',
    birth_place: body.birthPlace || body.birth_place || '',
    death_date: body.deathDate || body.death_date || '',
    death_place: body.deathPlace || body.death_place || '',
    occupation: body.occupation || '',
    education: body.education || '',
    bio: body.bio || '',
    notes: body.notes || '',
    is_alive: body.isAlive ?? body.is_alive ?? 1,
    x_pos: body.xPos ?? body.x_pos ?? 500,
    y_pos: body.yPos ?? body.y_pos ?? 200,
    photo_url: body.photoUrl || body.photo_url || null,
    ...overrides,
  };
}

function normalizeRelation(body, overrides = {}) {
  return {
    id: overrides.id || `r${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    member_id: body.memberId || body.member_id || '',
    related_member_id: body.relatedMemberId || body.related_member_id || '',
    relation_type: body.relationType || body.relation_type || 'parent',
    marriage_date: body.marriageDate || body.marriage_date || null,
    divorce_date: body.divorceDate || body.divorce_date || null,
    ...overrides,
  };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, 'https://example.com');
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    const segments = pathname.split('/').filter(Boolean);

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readBody(req);
      const user = state.users.find(u => u.email === body?.email && u.password === body?.password);
      if (!user) {
        sendJson(res, 401, { error: 'Неверный email или пароль' });
        return;
      }
      const token = createToken();
      state.sessions.set(token, user.id);
      sendJson(res, 200, { token, user: { id: user.id, name: user.name, email: user.email }, treeId: user.treeId });
      return;
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body?.email || !body?.password || !body?.name) {
        sendJson(res, 400, { error: 'Заполните все поля' });
        return;
      }
      if (state.users.some(u => u.email === body.email)) {
        sendJson(res, 409, { error: 'Пользователь уже существует' });
        return;
      }
      const newUser = { id: Date.now(), name: body.name, email: body.email, password: body.password, treeId: 'default' };
      state.users.push(newUser);
      const token = createToken();
      state.sessions.set(token, newUser.id);
      sendJson(res, 200, { token, user: { id: newUser.id, name: newUser.name, email: newUser.email }, treeId: newUser.treeId });
      return;
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const user = getUserByToken(token);
      if (!user) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      sendJson(res, 200, { user: { id: user.id, name: user.name, email: user.email }, treeId: user.treeId });
      return;
    }

    if (segments[0] === 'api' && segments[1] === 'members' && segments[2] === 'tree' && req.method === 'GET') {
      const tree = getTree(segments[3]);
      sendJson(res, 200, { members: tree.members, tree: { id: tree.id, name: tree.name } });
      return;
    }

    if (segments[0] === 'api' && segments[1] === 'relations' && segments[2] === 'tree' && req.method === 'GET') {
      const tree = getTree(segments[3]);
      sendJson(res, 200, { relations: tree.relations });
      return;
    }

    if (pathname === '/api/members' && req.method === 'POST') {
      const body = await readBody(req);
      const tree = getTree(body?.treeId || 'default');
      const member = normalizeMember(body);
      tree.members.push(member);
      sendJson(res, 200, { member });
      return;
    }

    if (pathname.startsWith('/api/members/') && req.method === 'PATCH' && segments[3] === 'position') {
      const body = await readBody(req);
      const tree = getTree('default');
      const member = tree.members.find(item => item.id === segments[2]);
      if (!member) {
        sendJson(res, 404, { error: 'Member not found' });
        return;
      }
      member.x_pos = body?.xPos ?? member.x_pos;
      member.y_pos = body?.yPos ?? member.y_pos;
      sendJson(res, 200, { member });
      return;
    }

    if (pathname.startsWith('/api/members/') && req.method === 'POST' && segments[3] === 'photo') {
      sendJson(res, 200, { photoUrl: '/uploads/placeholder.png' });
      return;
    }

    if (pathname.startsWith('/api/members/') && req.method === 'PUT') {
      const body = await readBody(req);
      const tree = getTree(body?.treeId || 'default');
      const index = tree.members.findIndex(item => item.id === segments[2]);
      if (index === -1) {
        sendJson(res, 404, { error: 'Member not found' });
        return;
      }
      tree.members[index] = normalizeMember(body, { id: segments[2], photo_url: tree.members[index].photo_url });
      sendJson(res, 200, { member: tree.members[index] });
      return;
    }

    if (pathname.startsWith('/api/members/') && req.method === 'DELETE') {
      const tree = getTree('default');
      tree.members = tree.members.filter(item => item.id !== segments[2]);
      tree.relations = tree.relations.filter(item => item.member_id !== segments[2] && item.related_member_id !== segments[2]);
      sendJson(res, 200, { success: true });
      return;
    }

    if (pathname === '/api/relations' && req.method === 'POST') {
      const body = await readBody(req);
      const tree = getTree(body?.treeId || 'default');
      const relation = normalizeRelation(body);
      tree.relations.push(relation);
      sendJson(res, 200, { relation });
      return;
    }

    if (pathname.startsWith('/api/relations/') && req.method === 'DELETE') {
      const tree = getTree('default');
      tree.relations = tree.relations.filter(item => item.id !== segments[2]);
      sendJson(res, 200, { success: true });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

module.exports = handler;
module.exports.default = handler;
module.exports.handler = handler;
