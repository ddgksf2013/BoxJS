/**
 * BoxJS：刷新 AI 模型列表
 *
 * 从 CAIXIN_AI_API_URL 推导 /models 地址，使用 BoxJS 中保存的 API Key
 * 请求模型列表，并写入 @CAIXIN_AI_DISCOVERY.modelOptions。
 */

'use strict';

const DEFAULT_AI_UA = 'claude-cli/2.1.161 (external, cli)';

function read(key) {
  if (typeof $prefs !== 'undefined') return $prefs.valueForKey(key) || '';
  if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key) || '';
  return '';
}

function write(value, key) {
  if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(value, key);
  if (typeof $persistentStore !== 'undefined') return $persistentStore.write(value, key);
  return false;
}

function request(options) {
  if (typeof $task !== 'undefined') return $task.fetch(options);
  return new Promise((resolve, reject) => {
    $httpClient.get(options, (error, response, body) => {
      if (error) reject(error);
      else resolve({ ...response, body });
    });
  });
}

function modelsURL(apiURL) {
  return String(apiURL || '')
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/\/(?:responses|chat\/completions)$/i, '') + '/models';
}

function finish(message, error) {
  const subtitle = error ? '刷新失败' : '刷新成功';
  console.log(`${subtitle}：${message}`);
  if (typeof $notify !== 'undefined') $notify('财新每日任务', subtitle, message);
  else if (typeof $notification !== 'undefined') $notification.post('财新每日任务', subtitle, message);
  $done();
}

(async () => {
  const api = String(read('CAIXIN_AI_API_URL') || '').trim();
  if (!api) throw new Error('请先填写 API URL');

  const url = modelsURL(api);
  const key = String(read('CAIXIN_AI_API_KEY') || '').trim();
  const ua = String(read('CAIXIN_AI_USER_AGENT') || DEFAULT_AI_UA).trim();
  const headers = { Accept: 'application/json', 'User-Agent': ua };
  if (key) headers.Authorization = `Bearer ${key}`;

  const response = await request({ url, method: 'GET', headers });
  const status = Number(response.statusCode || response.status || 0);
  let payload;
  try {
    payload = JSON.parse(String(response.body || ''));
  } catch (_) {
    throw new Error('模型接口未返回 JSON');
  }
  if (status >= 400) throw new Error(`模型接口 HTTP ${status}`);

  const list = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.models) ? payload.models : Array.isArray(payload) ? payload : [];
  const ids = [...new Set(list.map(item => String(
    typeof item === 'string' ? item : item && (item.id || item.name || item.model) || ''
  ).trim()).filter(Boolean))].sort();
  if (!ids.length) throw new Error('没有读取到模型');

  let discovery = {};
  try {
    discovery = JSON.parse(read('CAIXIN_AI_DISCOVERY') || '{}');
  } catch (_) {}
  discovery.modelOptions = ids.map(id => ({ key: id, label: id }));
  discovery.modelsUrl = url;
  discovery.updatedAt = new Date().toISOString();
  if (!write(JSON.stringify(discovery), 'CAIXIN_AI_DISCOVERY')) {
    throw new Error('模型列表保存失败');
  }

  const currentModel = String(read('CAIXIN_AI_MODEL') || '').trim();
  if (!ids.includes(currentModel)) {
    const preferred = ids.find(id => id === 'deepseek-flash')
      || ids.find(id => /deepseek/i.test(id))
      || ids[0];
    if (!write(preferred, 'CAIXIN_AI_MODEL')) throw new Error('默认模型保存失败');
  }

  finish(`已获取 ${ids.length} 个模型。请刷新或重新打开 BoxJS 页面后再展开“模型名称”，仅返回应用页不会刷新下拉数据。`, false);
})().catch(error => finish(error && error.message ? error.message : String(error), true));
