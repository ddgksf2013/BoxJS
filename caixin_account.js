const NAME = '财新账号导入';
const STORE_KEY = 'CAIXIN_DAILY_AUTH';
const INPUT_KEY = 'CAIXIN_MANUAL_COOKIE';

(async () => {
  const incomingCookie = String(read(INPUT_KEY) || '').trim();
  if (!incomingCookie) throw new Error('请先在 BoxJS 中粘贴完整 Cookie');

  const uidRaw = getCookie(incomingCookie, 'SA_USER_UID') || getCookie(incomingCookie, 'UID');
  if (!uidRaw) throw new Error('Cookie 中未找到 SA_USER_UID 或 UID');
  if (!getCookie(incomingCookie, 'appinfo')) throw new Error('Cookie 中缺少非空 appinfo');

  const uid = normalizeUid(uidRaw);
  const store = readStore();
  const old = store.account[uid] || {};
  const cookie = mergeCookies(old.cookie || '', incomingCookie);
  const nickname = getCookie(cookie, 'SA_USER_NICK_NAME');

  store.account[uid] = {
    ...old,
    uid,
    uidRaw: String(uidRaw),
    cookie,
    ...(nickname ? { nickname } : {}),
    updatedAt: new Date().toISOString(),
  };

  if (!write(JSON.stringify(store), STORE_KEY)) throw new Error('账号保存失败');
  write('', INPUT_KEY);
  notify(NAME, old.cookie ? '账号已更新' : '账号已添加', `账号：${mask(uid)}`);
})().catch(error => {
  notify(NAME, '导入失败', error && error.message ? error.message : String(error));
}).finally(() => {
  if (typeof $done === 'function') $done();
});

function readStore() {
  try {
    const value = JSON.parse(String(read(STORE_KEY) || ''));
    if (value && value.account && typeof value.account === 'object' && !Array.isArray(value.account)) return value;
  } catch (_) {}
  return { account: {} };
}

function mergeCookies(oldCookie, newCookie) {
  const map = Object.create(null);
  for (const source of [oldCookie, newCookie]) {
    String(source || '').split(';').forEach(part => {
      const index = part.indexOf('=');
      if (index <= 0) return;
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!value || /^(?:deleted|null|undefined)$/i.test(value)) delete map[key];
      else map[key] = { name, value };
    });
  }
  return Object.keys(map).map(key => `${map[key].name}=${map[key].value}`).join('; ');
}

function getCookie(cookie, name) {
  const target = String(name || '').toLowerCase();
  const part = String(cookie || '').split(';').find(item => {
    const index = item.indexOf('=');
    return index > 0 && item.slice(0, index).trim().toLowerCase() === target;
  });
  if (!part) return '';
  return decodeURIComponentSafe(part.slice(part.indexOf('=') + 1).trim());
}

function normalizeUid(uid) {
  const value = String(uid || '').trim();
  return /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, '') : value;
}

function decodeURIComponentSafe(value) {
  try { return decodeURIComponent(String(value || '').replace(/\+/g, '%20')); } catch (_) { return String(value || ''); }
}

function mask(value) {
  const text = String(value || '');
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${text.slice(0, 2)}${'*'.repeat(Math.min(6, text.length - 4))}${text.slice(-2)}`;
}

function read(key) {
  if (typeof $prefs !== 'undefined') return $prefs.valueForKey(key);
  if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key);
  return '';
}

function write(value, key) {
  if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(String(value), key);
  if (typeof $persistentStore !== 'undefined') return $persistentStore.write(String(value), key);
  return false;
}

function notify(title, subtitle, body) {
  if (typeof $notify !== 'undefined') $notify(title, subtitle, body);
  else if (typeof $notification !== 'undefined') $notification.post(title, subtitle, body);
  else console.log(`${title} ${subtitle} ${body}`);
}
