// v2 插件全套模拟验证：宿主（命令 + 4 个路由）+ 客户端 bundle（section 注册）
import { pathToFileURL } from 'node:url';
import assert from 'node:assert';

const PKG = 'C:/Users/chene/.dsh/profiles/desktop/plugins/dsh-free-models-update';

// ============ 1. 宿主插件 ============
const host = await import(pathToFileURL(`${PKG}/index.js`).href);
assert.strictEqual(host.name, 'dsh-free-models-update');
assert.deepStrictEqual(host.inject, ['commands', 'webServer']);
assert.strictEqual(typeof host.apply, 'function');
console.log('1. 宿主插件导出 OK (name/inject/apply)');

// mock 数据
const FAKE_MODELS = [
  { id: 'google/gemma-4-31b-it:free', name: 'Google: Gemma 4 31B (free)', created: 1787846290, architecture: { input_modalities: ['text', 'image'] }, context_length: 262144 },
  { id: 'z-ai/glm-5.2:free', name: 'Z.ai: GLM 5.2 (free)', created: 1787840000, architecture: { input_modalities: ['text'] }, context_length: 131072 },
  { id: 'nvidia/nemotron-3.5-content-safety:free', name: 'NVIDIA: Nemotron 3.5 Content Safety (free)', created: 1787800000, architecture: { input_modalities: ['text'] } },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'NVIDIA: Nemotron 3 Super 120B A12B (free)', created: 1786400000, architecture: { input_modalities: ['text'] } }
];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('/models')) return { ok: true, json: async () => ({ data: FAKE_MODELS }) };
  if (u.includes('/key')) return { ok: true, json: async () => ({ data: { is_free_tier: true, usage: 42 } }) };
  if (u.includes('/chat/completions')) return { ok: true, json: async () => ({ model: 'nvidia/nemotron-3-super-120b-a12b:free', choices: [{ message: { content: '成功' } }] }) };
  throw new Error('unexpected fetch: ' + u);
};

let registeredRoute = null;
let registeredCommand = null;
const mutateCalls = [];
const settingsMock = {
  mutate: async (ns, ops) => { mutateCalls.push({ ns, ops }); },
  describe: (opts) => [{ ns: 'llm-pi-ai', value: { providers: { openrouter: { models: [{ id: 'a:free', name: 'A 免费' }] } } } }]
};
const credsMock = {
  describe: async (ref) => ({ configured: true, source: 'file' }),
  resolve: async (ref) => ({ value: 'sk-or-v1-testkey1234567890' }),
  set: async (ref, val) => { credsMock.lastSet = { ref, val }; }
};
const mockCtx = {
  get: (name) => (name === 'settings' ? settingsMock : name === 'credentials' ? credsMock : undefined),
  logger: { warn: (...a) => console.log('  [ctx.logger.warn]', ...a) },
  commands: { register: (def) => { registeredCommand = def; } },
  webServer: { register: (route) => { registeredRoute = route; } }
};
host.apply(mockCtx);

assert.ok(registeredCommand, 'command registered');
assert.strictEqual(registeredCommand.name, 'update-free-models');
assert.ok(registeredRoute, 'route registered');
assert.strictEqual(registeredRoute.kind, 'prefix');
console.log('2. 命令 + webServer 路由注册 OK');

// 模拟 HTTP 请求
function fakeReq(method, path, headers = {}, body = '') {
  return {
    method,
    url: path,
    headers: { host: '127.0.0.1:43120', ...headers },
    on: (ev, cb) => { if (ev === 'data' && body) cb(Buffer.from(body)); if (ev === 'end') cb(); }
  };
}
function fakeRes() {
  const r = { status: 0, headers: {}, body: '' };
  r.writeHead = (code, h) => { r.status = code; Object.assign(r.headers, h); };
  r.end = (b) => { r.body = b || ''; };
  return r;
}

// /state
{
  const res = fakeRes();
  await registeredRoute.handler(fakeReq('GET', '/free-models-update/state'), res);
  const d = JSON.parse(res.body);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(d.keyConfigured, true);
  assert.ok(d.models.length >= 1, 'models from settings fallback');
  console.log('3. GET /state OK (keyConfigured=' + d.keyConfigured + ', models=' + d.count + ')');
}

// /refresh（应过滤 content-safety、标注多模态）
{
  const res = fakeRes();
  await registeredRoute.handler(fakeReq('POST', '/free-models-update/refresh'), res);
  const d = JSON.parse(res.body);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(d.count, 3, '3 chat models (content-safety excluded)');
  const gemma = d.models.find((m) => m.id.startsWith('google'));
  assert.strictEqual(gemma.modality, 'multimodal');
  assert.strictEqual(typeof gemma.created, 'number');
  const lastOp = mutateCalls.at(-1).ops.find((o) => o.path.at(-1) === 'models');
  assert.deepStrictEqual(lastOp.value.map((m) => m.id), ['google/gemma-4-31b-it:free', 'z-ai/glm-5.2:free', 'nvidia/nemotron-3-super-120b-a12b:free']);
  console.log('4. POST /refresh OK (3 个模型，多模态标注，排除分类器，mutate 写入正确顺序)');
}

// /test
{
  const res = fakeRes();
  await registeredRoute.handler(fakeReq('POST', '/free-models-update/test'), res);
  const d = JSON.parse(res.body);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(d.keyValid, true);
  assert.strictEqual(d.freeTier, true);
  assert.strictEqual(d.usage, 42);
  assert.strictEqual(d.test.response, '成功');
  console.log('5. POST /test OK (key 有效/免费档/用量 42/真实调用回复「成功」)');
}

// /key
{
  const res = fakeRes();
  await registeredRoute.handler(fakeReq('POST', '/free-models-update/key', { 'content-type': 'application/json' }, JSON.stringify({ key: 'sk-or-v1-newkey' })), res);
  const d = JSON.parse(res.body);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(d.ok, true);
  assert.strictEqual(credsMock.lastSet.ref, 'OPENROUTER_API_KEY');
  assert.strictEqual(credsMock.lastSet.val, 'sk-or-v1-newkey');
  console.log('6. POST /key OK (credentials.set 写入 OPENROUTER_API_KEY)');
}

// 门禁：非回环 Host 拒绝
{
  const res = fakeRes();
  await registeredRoute.handler(fakeReq('GET', '/free-models-update/state', { host: 'evil.example.com' }), res);
  assert.strictEqual(res.status, 403);
  console.log('7. 门禁 OK（非回环 Host -> 403）');
}

// 命令 handler
{
  const cmdRes = await registeredCommand.handler({ rawInput: '' });
  assert.strictEqual(cmdRes.kind, 'success');
  console.log('8. 命令 handler OK:', cmdRes.text.slice(0, 60) + '...');
}

globalThis.fetch = realFetch;

// ============ 2. 客户端 bundle ============
let capturedLoad = null;
const reactStub = {
  useState: () => ['', () => {}],
  useEffect: () => {},
  createElement: () => ({ __stub: 'element' })
};
globalThis.window = { __ModuleLoader__: { load: (o) => { capturedLoad = o; } } };
const clientSrc = await import(pathToFileURL(`${PKG}/client.js`).href + '?t=' + Date.now());
// factory 直接执行（node 下 window.__ModuleLoader__ 已 stub，bundle 调用 load）
assert.ok(capturedLoad, 'bundle must call __ModuleLoader__.load');
assert.strictEqual(capturedLoad.id, 'dsh-free-models-update');
const exportsObj = capturedLoad.factory((spec) => {
  if (spec === 'react') return reactStub;
  throw new Error('unexpected require: ' + spec);
});
assert.strictEqual(typeof exportsObj.apply, 'function');
assert.deepStrictEqual(exportsObj.inject, ['slots']);
console.log('9. 客户端 bundle 加载 OK (id=' + capturedLoad.id + ', inject=' + exportsObj.inject + ')');

// apply -> slots.inject -> register
let injectName = null;
let injectFn = null;
let registered = null;
const slotsMock = {
  inject: (name, fn) => { injectName = name; injectFn = fn; },
  register: (opts, comp) => { registered = { opts, comp }; return () => {}; }
};
const clientCtx = { slots: slotsMock };
exportsObj.apply(clientCtx);
assert.strictEqual(injectName, 'settings.section');
const disposer = injectFn();
assert.strictEqual(typeof disposer, 'function');
assert.strictEqual(registered.opts.name, 'settings.section');
assert.strictEqual(registered.opts.id, 'free-models');
assert.strictEqual(registered.opts.label(), '免费模型');
assert.strictEqual(typeof registered.comp, 'function');
console.log('10. 客户端 section 注册 OK (settings.section / free-models / 「免费模型」)');

console.log('\n✅ v2 插件全部验证通过');
