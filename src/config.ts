import { PluginSettingTab, Setting, App } from 'obsidian';
import DiscourseSyncPlugin from './main';

export interface DiscourseSyncSettings {
	baseUrl: string;
	apiKey: string;
	disUser: string;
	category: number;
}

export const DEFAULT_SETTINGS: DiscourseSyncSettings = {
	baseUrl: "https://yourforum.example.com",
	apiKey: "apikey",
	disUser: "DiscourseUsername",
	category: 1,
};

export class DiscourseSyncSettingsTab extends PluginSettingTab {
	plugin: DiscourseSyncPlugin;
	constructor(app: App, plugin: DiscourseSyncPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Discourse Sync" });

		new Setting(containerEl)
			.setName("Base URL")
			.setDesc("base url of discourse server")
			.addText((text) =>
				text
					.setPlaceholder("https://forum.example.com")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value;
						await this.plugin.saveSettings();
					})
		);

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("user created API Key")
			.addText((text) =>
				text
					.setPlaceholder("api_key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					})
		);

		new Setting(containerEl)
			.setName("Username")
			.setDesc("Discourse Username")
			.addText((text) =>
				text
					.setPlaceholder("username")
					.setValue(this.plugin.settings.disUser)
					.onChange(async (value) => {
						this.plugin.settings.disUser = value;
						await this.plugin.saveSettings();
					}),
		);
	}
}
