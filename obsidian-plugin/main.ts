import { Plugin, Notice, requestUrl, PluginSettingTab, Setting, App } from "obsidian";

interface McpHubSettings {
  hubUrl: string;
  apiKey: string;
  lastSyncAt: string;
  lastHealth: string;
}

const DEFAULT_SETTINGS: McpHubSettings = {
  hubUrl: "http://localhost:8787",
  apiKey: "",
  lastSyncAt: "",
  lastHealth: "",
};

export default class McpHubBrainSync extends Plugin {
  settings: McpHubSettings = { ...DEFAULT_SETTINGS };
  statusEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new McpHubSettingTab(this.app, this));

    this.addCommand({
      id: "mcp-hub-push",
      name: "Push to Hub",
      callback: () => this.pushToHub(),
    });
    this.addCommand({
      id: "mcp-hub-pull",
      name: "Pull from Hub",
      callback: () => this.pullFromHub(),
    });
    this.addCommand({
      id: "mcp-hub-health",
      name: "Check Hub health",
      callback: () => this.refreshStatus(),
    });

    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("mcp-hub-status");
    this.statusEl.setText("MCP Hub: —");
    this.statusEl.onClickEvent(() => this.refreshStatus());
    void this.refreshStatus();
  }

  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  headers() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.settings.apiKey}`,
    };
  }

  async hubRequest(path: string, method = "GET", body?: unknown) {
    const url = `${this.settings.hubUrl.replace(/\/$/, "")}${path}`;
    const res = await requestUrl({
      url,
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
      throw: false,
    });
    if (res.status >= 400) {
      throw new Error(`HTTP ${res.status}: ${res.text?.slice(0, 200) || "error"}`);
    }
    return res.json;
  }

  setStatus(text: string) {
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
      const sync = this.settings.lastSyncAt ? ` · ${this.settings.lastSyncAt}` : "";
      this.setStatus(`MCP Hub: ${ok}${sync}`);
      await this.saveSettings();
    } catch (e) {
      this.setStatus("MCP Hub: offline");
      new Notice(`Hub health failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async pushToHub() {
    try {
      const json = await this.hubRequest("/brain/obsidian/sync", "POST");
      const data = json?.data ?? json;
      this.settings.lastSyncAt = new Date().toLocaleTimeString();
      await this.saveSettings();
      new Notice(`Pushed ${data?.synced ?? 0} memories`);
      await this.refreshStatus();
    } catch (e) {
      new Notice(`Push failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async pullFromHub() {
    try {
      const json = await this.hubRequest("/brain/obsidian/pull", "POST");
      const data = json?.data ?? json;
      this.settings.lastSyncAt = new Date().toLocaleTimeString();
      await this.saveSettings();
      new Notice(`Pulled ${data?.updated ?? 0} updates`);
      await this.refreshStatus();
    } catch (e) {
      new Notice(`Pull failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

class McpHubSettingTab extends PluginSettingTab {
  plugin: McpHubBrainSync;

  constructor(app: App, plugin: McpHubBrainSync) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "MCP Hub Brain Sync" });

    new Setting(containerEl)
      .setName("Hub URL")
      .setDesc("MCP Hub base URL (e.g. http://localhost:8787)")
      .addText((t) =>
        t.setValue(this.plugin.settings.hubUrl).onChange(async (v) => {
          this.plugin.settings.hubUrl = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Write scope key for sync operations")
      .addText((t) =>
        t
          .setPlaceholder("HUB_WRITE_KEY or admin")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (v) => {
            this.plugin.settings.apiKey = v;
            await this.plugin.saveSettings();
          })
      );
  }
}
