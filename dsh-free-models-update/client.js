// dsh-free-models-update — 客户端 bundle（浏览器侧）
// 自足版：不再依赖宿主 webServer 路由（被桌面门禁拦截）。
// 模型列表/测试用 OpenRouter 公开接口（CORS 放开）；写配置/存 Key 用官方 /api（settings/credentials，GUI 同款）。
// api 通过注册的 inject face 传给卡片（BashCard 同款：inject:()=>({api}) → props.api）。
window.__ModuleLoader__.load({
  id: "dsh-free-models-update",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");

    var CRED_REF = "OPENROUTER_API_KEY";
    var MODELS_API = "https://openrouter.ai/api/v1/models";
    var KEY_API = "https://openrouter.ai/api/v1/key";
    var CHAT_API = "https://openrouter.ai/api/v1/chat/completions";
    var TEST_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
    var EXCLUDE = /content[\s-]*safety|moderation|classifier|embedding|rerank|re-ranker|similarity/i;
    var NEW_WINDOW = 7 * 86400;

    var S = {
      card: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "760px" },
      row: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
      input: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", color: "var(--dsw-alias-label-primary)", borderRadius: "8px", padding: "6px 10px", fontSize: "13px", fontFamily: "ui-monospace, SFMono-Regular, monospace", flex: 1, minWidth: "220px" },
      button: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", cursor: "pointer" },
      buttonPrimary: { border: "1px solid transparent", background: "var(--dsw-alias-brand-primary, #42b883)", color: "#fff", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", cursor: "pointer" },
      disabled: { opacity: 0.5, cursor: "default" },
      badge: { borderRadius: "999px", padding: "1px 8px", fontSize: "11px", lineHeight: "17px", fontWeight: "500", whiteSpace: "nowrap" },
      badgeText: { background: "var(--dsw-alias-bg-module-platform)", color: "var(--dsw-alias-label-secondary)" },
      badgeMulti: { background: "rgba(139,92,246,0.16)", color: "rgb(167,139,250)" },
      badgeNew: { background: "rgba(16,185,129,0.16)", color: "rgb(52,211,153)" },
      item: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid var(--dsw-alias-border-l1)" },
      name: { color: "var(--dsw-alias-label-primary)", fontSize: "13px", fontWeight: "500" },
      mono: { fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" },
      muted: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px" },
      error: { color: "var(--dsw-alias-label-error)", fontSize: "12px" },
      ok: { color: "var(--dsw-alias-label-success, #34d399)", fontSize: "12px" },
      dot: { width: "8px", height: "8px", borderRadius: "50%", display: "inline-block" },
      dotOn: { background: "#34d399" },
      dotOff: { background: "#f87171" },
      title: { color: "var(--dsw-alias-label-primary)", fontSize: "14px", fontWeight: "600" },
      section: { display: "flex", flexDirection: "column", gap: "8px" }
    };

    function friendly(n) {
      var x = String(n || "").replace(/\s*\(free\)\s*$/i, "").trim();
      return x ? x + " 免费" : "";
    }
    function modality(m) { return (m && m.length > 1) ? "multimodal" : "text"; }

    // OpenRouter key 必须全是可打印 ASCII；否则 fetch 的 Authorization 头会因非 Latin-1 字符报错。
    function cleanKey(k) {
      var t = String(k || "").trim();
      if (/[^\x21-\x7E]/.test(t)) return null;
      return t;
    }

    function FreeModelsSection(props) {
      var api = props.api;
      var state = React.useState({ loading: false, testing: false, saving: false, error: null, models: [], keyConfigured: false, keySource: null, testResult: null });
      var s = state[0], set = state[1];
      var keyDraft = React.useState("");
      var draft = keyDraft[0], setDraft = keyDraft[1];

      function applyPatch(extra) { set(function (prev) { return Object.assign({}, prev, extra); }); }

      function load() {
        var keyStatus = Promise.resolve({ configured: false });
        if (api && api.credentials && api.credentials.describe) {
          keyStatus = api.credentials.describe({ refs: [CRED_REF] })
            .then(function (resp) {
              var c = resp && resp.result && resp.result.ok ? (resp.result.value && resp.result.value.credentials) : null;
              var entry = c ? c[CRED_REF] : null;
              return { configured: !!(entry && entry.configured), source: entry && entry.source ? entry.source : null };
            })
            .catch(function () { return { configured: false }; });
        }
        Promise.all([
          fetch(MODELS_API, { headers: { accept: "application/json" }, mode: "cors" }).then(function (r) { return r.json(); }),
          keyStatus
        ]).then(function (arr) {
            var data = arr[0] || {};
            var ks = arr[1] || { configured: false };
            var list = (data.data || []).filter(function (m) { var id = String(m.id || ""); var name = String(m.name || id); return id.indexOf(":free") >= 0 && !EXCLUDE.test(name); });
            applyPatch({ models: list, keyConfigured: ks.configured, keySource: ks.source, error: null });
          })
          .catch(function (e) { applyPatch({ error: String(e) }); });
      }

      React.useEffect(function () { load(); }, []);

      function fetchFreeModels() {
        return fetch(MODELS_API, { headers: { accept: "application/json" }, mode: "cors" })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            return (data.data || []).filter(function (m) { var id = String(m.id || ""); var name = String(m.name || id); return id.indexOf(":free") >= 0 && !EXCLUDE.test(name); });
          });
      }

      function refresh() {
        applyPatch({ loading: true, error: null });
        if (!api || !api.settings || !api.settings.mutate) { applyPatch({ loading: false, error: "settings api 不可用" }); return; }
        fetchFreeModels()
          .then(function (list) {
            var models = list.map(function (m) { return { id: String(m.id), name: friendly(m.name) || String(m.id) }; });
            return api.settings.mutate({
              ns: "llm-pi-ai",
              ops: [
                { op: "set", path: ["providers", "openrouter", "baseURL"], value: "https://openrouter.ai/api/v1" },
                { op: "set", path: ["providers", "openrouter", "api"], value: "openai-completions" },
                { op: "set", path: ["providers", "openrouter", "apiKeyEnv"], value: CRED_REF },
                { op: "set", path: ["providers", "openrouter", "models"], value: models }
              ]
            }).then(function (resp) {
              if (!resp || !resp.result || !resp.result.ok) throw new Error((resp && resp.result && resp.result.error && resp.result.error.message) || "写入配置失败");
              return models;
            });
          })
          .then(function (models) { applyPatch({ loading: false, models: models, error: null }); })
          .catch(function (e) { applyPatch({ loading: false, error: String(e) }); });
      }

      function saveKey() {
        var key = cleanKey(draft);
        if (!key) { applyPatch({ error: "请先输入 OpenRouter Key（仅含可打印 ASCII）" }); return; }
        if (!api || !api.credentials || !api.credentials.set) { applyPatch({ error: "credentials api 不可用" }); return; }
        applyPatch({ saving: true, error: null });
        api.credentials.set({ ref: CRED_REF, value: key })
          .then(function (resp) {
            if (!resp || !resp.result || !resp.result.ok) throw new Error((resp && resp.result && resp.result.error && resp.result.error.message) || "保存失败");
            applyPatch({ saving: false, keyConfigured: true, keySource: "file", error: null });
          })
          .catch(function (e) { applyPatch({ saving: false, error: String(e) }); });
      }

      function testKey() {
        var key = cleanKey(draft);
        if (!key) { applyPatch({ error: "请先输入 Key 再测试（仅含可打印 ASCII；可用「保存 Key」先存）" }); return; }
        applyPatch({ testing: true, testResult: null, error: null });
        fetch(KEY_API, { headers: { authorization: "Bearer " + key }, mode: "cors" })
          .then(function (r) { return r.json(); })
          .then(function (keyInfo) {
            var data = keyInfo && keyInfo.data;
            var keyValid = !!(data && !data.error);
            var freeTier = !!(data && data.is_free_tier);
            var usage = data ? data.usage : null;
            return fetch(CHAT_API, {
              method: "POST",
              headers: { authorization: "Bearer " + key, "content-type": "application/json" },
              body: JSON.stringify({ model: TEST_MODEL, messages: [{ role: "user", content: "只回复两个字：成功" }], max_tokens: 16 }),
              mode: "cors"
            })
              .then(function (cr) { return cr.json().then(function (cd) {
                return { keyValid: keyValid, freeTier: freeTier, usage: usage, modelUsed: cd.model || TEST_MODEL, response: cr.ok ? (cd.choices && cd.choices[0] && cd.choices[0].message && cd.choices[0].message.content) || "" : ("HTTP " + cr.status) };
              }).catch(function () { return { keyValid: keyValid, freeTier: freeTier, usage: usage, modelUsed: TEST_MODEL, response: "(解析失败)" }; }); });
          })
          .then(function (r) { applyPatch({ testing: false, testResult: r }); })
          .catch(function (e) { applyPatch({ testing: false, testResult: { error: "测试失败：" + String(e) } }); });
      }

      var rows = (s.models || []).slice().sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
      var now = Date.now() / 1000;
      var listItems = rows.map(function (m) {
        var isNew = typeof m.created === "number" && now - m.created <= NEW_WINDOW;
        var mod = modality(m.architecture && m.architecture.input_modalities);
        return React.createElement("div", { key: m.id || m.name, style: S.item },
          React.createElement("span", { style: S.name }, friendly(m.name) || m.name || m.id),
          React.createElement("span", { style: S.mono }, String(m.id || m.name)),
          React.createElement("span", { style: Object.assign({}, S.badge, mod === "multimodal" ? S.badgeMulti : S.badgeText) }, mod === "multimodal" ? "多模态" : "文本"),
          isNew ? React.createElement("span", { style: Object.assign({}, S.badge, S.badgeNew) }, "NEW") : null
        );
      });

      var testResult = null;
      if (s.testResult) {
        var t = s.testResult;
        if (t.error) testResult = React.createElement("div", { style: S.error }, t.error);
        else testResult = React.createElement("div", { style: S.section },
          React.createElement("div", { style: t.keyValid ? S.ok : S.error }, "Key " + (t.keyValid ? "有效 ✓" : "无效 ✗") + (t.freeTier ? " · 免费档" : "") + (typeof t.usage === "number" ? " · 用量 " + t.usage : "")),
          React.createElement("div", { style: S.muted }, "测试模型 " + t.modelUsed + " 回复：「" + t.response + "」")
        );
      }

      return React.createElement("div", { style: S.card },
        React.createElement("div", { style: S.row },
          React.createElement("span", { style: S.title }, "OpenRouter 免费模型"),
          React.createElement("span", { style: S.muted }, "共 " + (s.models ? s.models.length : 0) + " 个")
        ),
        React.createElement("div", { style: S.row },
          React.createElement("input", { style: S.input, type: "password", placeholder: "sk-or-v1-... 你的 OpenRouter Key", value: draft, onChange: function (e) { setDraft(e.target.value); } }),
          React.createElement("button", { style: Object.assign({}, S.buttonPrimary, s.saving ? S.disabled : null), disabled: s.saving, onClick: saveKey }, s.saving ? "保存中…" : "保存 Key"),
          React.createElement("span", { style: Object.assign({}, S.dot, s.keyConfigured ? S.dotOn : S.dotOff) }),
          React.createElement("span", { style: s.keyConfigured ? S.ok : S.error }, s.keyConfigured ? "已配置" : "未配置"),
          React.createElement("button", { style: Object.assign({}, S.button, s.testing ? S.disabled : null), disabled: s.testing, onClick: testKey }, s.testing ? "测试中…" : "测试调用")
        ),
        React.createElement("div", { style: S.row },
          React.createElement("button", { style: Object.assign({}, S.buttonPrimary, s.loading ? S.disabled : null), disabled: s.loading, onClick: refresh }, s.loading ? "更新中…" : "🔄 一键更新"),
          React.createElement("span", { style: S.muted }, "直连 OpenRouter API")
        ),
        s.error ? React.createElement("div", { style: S.error }, "错误：" + s.error) : null,
        testResult,
        React.createElement("div", { style: S.section }, listItems.length > 0 ? listItems : React.createElement("div", { style: S.muted }, "暂无模型，点「一键更新」拉取"))
      );
    }

    var inject = ["slots", "connection"];

    function apply(ctx) {
      var api = ctx.get("connection") && ctx.get("connection").api;
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "free-models",
          order: 200,
          label: function () { return "免费模型"; },
          inject: function () { return { api: api }; }
        }, FreeModelsSection);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
