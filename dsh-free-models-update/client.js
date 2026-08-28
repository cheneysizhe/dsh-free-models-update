// dsh-free-models-update — 客户端 bundle（浏览器侧）
// 格式遵循官方构建产物：window.__ModuleLoader__.load({ id, factory })
// 能力：在「设置」导航注册「免费模型」分区页（settings.section slot）
// 页面：Key 输入/保存/测试 + 一键更新 + 模型清单（文本/多模态徽章、NEW 置顶）
window.__ModuleLoader__.load({
  id: "dsh-free-models-update",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var NS = "free-models-update";
    var NEW_WINDOW = 7 * 86400; // 7 天内算「最新」

    var S = {
      card: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "760px" },
      row: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
      label: { color: "var(--dsw-alias-label-primary)", fontSize: "13px", fontWeight: "500", minWidth: "90px" },
      input: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", color: "var(--dsw-alias-label-primary)", borderRadius: "8px", padding: "6px 10px", fontSize: "13px", fontFamily: "ui-monospace, SFMono-Regular, monospace", flex: 1, minWidth: "220px" },
      button: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", cursor: "pointer" },
      buttonPrimary: { border: "1px solid transparent", background: "var(--dsw-alias-brand-primary, #42b883)", color: "#fff", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", cursor: "pointer" },
      buttonDisabled: { opacity: 0.5, cursor: "default" },
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

    function FreeModelsSection() {
      var state = React.useState({
        loading: false, testing: false, saving: false, error: null,
        keyConfigured: false, keySource: null, lastUpdated: null,
        models: [], count: 0, testResult: null
      });
      var s = state[0], set = state[1];
      var keyDraft = React.useState("");
      var draft = keyDraft[0], setDraft = keyDraft[1];

      function load() {
        fetch("/free-models-update/state", { headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            set(Object.assign({}, s, {
              models: d.models || [], count: d.count || 0,
              keyConfigured: !!d.keyConfigured, keySource: d.keySource,
              lastUpdated: d.lastUpdated, error: null
            }));
          })
          .catch(function (e) { set(Object.assign({}, s, { error: String(e) })); });
      }

      React.useEffect(function () { load(); }, []);

      function refresh() {
        set(Object.assign({}, s, { loading: true, error: null }));
        fetch("/free-models-update/refresh", { method: "POST", headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d.ok) throw new Error(d.error || "刷新失败");
            set(Object.assign({}, s, { loading: false, models: d.models || [], count: d.count || 0, lastUpdated: d.lastUpdated }));
          })
          .catch(function (e) { set(Object.assign({}, s, { loading: false, error: String(e) })); });
      }

      function testKey() {
        set(Object.assign({}, s, { testing: true, testResult: null }));
        fetch("/free-models-update/test", { method: "POST", headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (d) { set(Object.assign({}, s, { testing: false, testResult: d })); })
          .catch(function (e) { set(Object.assign({}, s, { testing: false, testResult: { ok: false, error: String(e) } })); });
      }

      function saveKey() {
        set(Object.assign({}, s, { saving: true, error: null }));
        fetch("/free-models-update/key", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ key: draft })
        })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d.ok) throw new Error(d.error || "保存失败");
            setDraft("");
            set(Object.assign({}, s, { saving: false, keyConfigured: true, keySource: "file", error: null }));
          })
          .catch(function (e) { set(Object.assign({}, s, { saving: false, error: String(e) })); });
      }

      // 模型按最新倒序
      var rows = (s.models || []).slice().sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
      var now = Date.now() / 1000;
      var listItems = rows.map(function (m) {
        var isNew = typeof m.created === "number" && now - m.created <= NEW_WINDOW;
        var badges = [
          React.createElement("span", { key: "mod", style: Object.assign({}, S.badge, m.modality === "multimodal" ? S.badgeMulti : S.badgeText) },
            m.modality === "multimodal" ? "多模态" : "文本"),
          isNew ? React.createElement("span", { key: "new", style: Object.assign({}, S.badge, S.badgeNew) }, "NEW") : null
        ].filter(Boolean);
        return React.createElement("div", { key: m.id, style: S.item },
          React.createElement("span", { style: S.name }, m.name || m.id),
          React.createElement("span", { style: S.mono }, m.id),
          badges
        );
      });

      var keyStatusDot = React.createElement("span", { style: Object.assign({}, S.dot, s.keyConfigured ? S.dotOn : S.dotOff) });
      var keyStatusText = s.keyConfigured
        ? React.createElement("span", { style: S.ok }, "已配置" + (s.keySource ? "（" + s.keySource + "）" : ""))
        : React.createElement("span", { style: S.error }, "未配置");

      var testResult = null;
      if (s.testResult) {
        var t = s.testResult;
        if (t.ok) {
          var lines = [
            "Key " + (t.keyValid ? "有效 ✓" : "无效 ✗") + (t.freeTier ? " · 免费档" : ""),
            t.usage !== null ? "当月用量 " + t.usage : null,
            t.test ? "测试调用 " + t.test.modelUsed + " 回复：「" + t.test.response + "」" : null,
            t.keyError ? "Key 接口提示：" + t.keyError : null
          ].filter(Boolean);
          testResult = React.createElement("div", { style: S.section },
            lines.map(function (l, i) { return React.createElement("div", { key: i, style: t.keyValid ? S.ok : S.error }, l); })
          );
        } else {
          testResult = React.createElement("div", { style: S.error }, "测试失败：" + (t.error || "未知错误"));
        }
      }

      return React.createElement("div", { style: S.card },
        React.createElement("div", { style: S.row },
          React.createElement("span", { style: S.title }, "OpenRouter 免费模型"),
          React.createElement("span", { style: S.muted }, s.lastUpdated ? "上次更新 " + s.lastUpdated.replace("T", " ").slice(0, 16) : "尚未更新")
        ),
        React.createElement("div", { style: S.row },
          React.createElement("input", { style: S.input, type: "password", placeholder: "sk-or-v1-... 你的 OpenRouter Key", value: draft, onChange: function (e) { setDraft(e.target.value); } }),
          React.createElement("button", { style: Object.assign({}, S.buttonPrimary, s.saving ? S.buttonDisabled : null), disabled: s.saving, onClick: saveKey }, s.saving ? "保存中…" : "保存 Key"),
          keyStatusDot, keyStatusText,
          React.createElement("button", { style: Object.assign({}, S.button, s.testing ? S.buttonDisabled : null), disabled: s.testing, onClick: testKey }, s.testing ? "测试中…" : "测试调用")
        ),
        React.createElement("div", { style: S.row },
          React.createElement("button", { style: Object.assign({}, S.buttonPrimary, s.loading ? S.buttonDisabled : null), disabled: s.loading, onClick: refresh }, s.loading ? "更新中…" : "🔄 一键更新免费模型"),
          React.createElement("span", { style: S.muted }, "共 " + s.count + " 个")
        ),
        s.error ? React.createElement("div", { style: S.error }, "错误：" + s.error) : null,
        testResult,
        React.createElement("div", { style: S.section }, listItems.length > 0 ? listItems : React.createElement("div", { style: S.muted }, "暂无模型，点击「一键更新」拉取"))
      );
    }

    var inject = ["slots"];

    function apply(ctx) {
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "free-models",
          order: 200,
          label: function () { return "免费模型"; }
        }, FreeModelsSection);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
