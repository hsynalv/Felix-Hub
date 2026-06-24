var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => McpHubBrainSync
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  hubUrl: "http://localhost:8787",
  apiKey: "",
  lastSyncAt: "",
  lastHealth: ""
};
var McpHubBrainSync = class extends import_obsidian.Plugin {
  settings = { ...DEFAULT_SETTINGS };
  statusEl = null;
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new McpHubSettingTab(this.app, this));
    this.addCommand({
      id: "mcp-hub-push",
      name: "Push to Hub",
      callback: () => this.pushToHub()
    });
    this.addCommand({
      id: "mcp-hub-pull",
      name: "Pull from Hub",
      callback: () => this.pullFromHub()
    });
    this.addCommand({
      id: "mcp-hub-health",
      name: "Check Hub health",
      callback: () => this.refreshStatus()
    });
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("mcp-hub-status");
    this.statusEl.setText("MCP Hub: \u2014");
    this.statusEl.onClickEvent(() => this.refreshStatus());
    void this.refreshStatus();
  }
  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  headers() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.settings.apiKey}`
    };
  }
  async hubRequest(path, method = "GET", body) {
    const url = `${this.settings.hubUrl.replace(/\/$/, "")}${path}`;
    const res = await (0, import_obsidian.requestUrl)({
      url,
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : void 0,
      throw: false
    });
    if (res.status >= 400) {
      throw new Error(`HTTP ${res.status}: ${res.text?.slice(0, 200) || "error"}`);
    }
    return res.json;
  }
  setStatus(text) {
    if (this.statusEl) this.statusEl.setText(text);
  }
  async refreshStatus() {
    if (!this.settings.apiKey) {
      this.setStatus("MCP Hub: set API key");
      return;
    }
    try {
      const json = await this.hubRequest("/brain/obsidian/status");
      const data = json?.data ?? json;
      const ok = data?.enabled ? "vault ok" : "export off";
      this.settings.lastHealth = ok;
      const sync = this.settings.lastSyncAt ? ` \xB7 ${this.settings.lastSyncAt}` : "";
      this.setStatus(`MCP Hub: ${ok}${sync}`);
      await this.saveSettings();
    } catch (e) {
      this.setStatus("MCP Hub: offline");
      new import_obsidian.Notice(`Hub health failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  async pushToHub() {
    try {
      const json = await this.hubRequest("/brain/obsidian/sync", "POST");
      const data = json?.data ?? json;
      this.settings.lastSyncAt = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      await this.saveSettings();
      new import_obsidian.Notice(`Pushed ${data?.synced ?? 0} memories`);
      await this.refreshStatus();
    } catch (e) {
      new import_obsidian.Notice(`Push failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  async pullFromHub() {
    try {
      const json = await this.hubRequest("/brain/obsidian/pull", "POST");
      const data = json?.data ?? json;
      this.settings.lastSyncAt = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      await this.saveSettings();
      new import_obsidian.Notice(`Pulled ${data?.updated ?? 0} updates`);
      await this.refreshStatus();
    } catch (e) {
      new import_obsidian.Notice(`Pull failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
};
var McpHubSettingTab = class extends import_obsidian.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "MCP Hub Brain Sync" });
    new import_obsidian.Setting(containerEl).setName("Hub URL").setDesc("MCP Hub base URL (e.g. http://localhost:8787)").addText(
      (t) => t.setValue(this.plugin.settings.hubUrl).onChange(async (v) => {
        this.plugin.settings.hubUrl = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("API key").setDesc("Write scope key for sync operations").addText(
      (t) => t.setPlaceholder("HUB_WRITE_KEY or admin").setValue(this.plugin.settings.apiKey).onChange(async (v) => {
        this.plugin.settings.apiKey = v;
        await this.plugin.saveSettings();
      })
    );
  }
};
