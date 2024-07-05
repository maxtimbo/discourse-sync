import { PluginSettingTab, Setting, App, ButtonComponent } from 'obsidian';
import DiscourseSyncPlugin from './main';

export interface DiscourseSyncSettings {
	baseUrl: string;
	apiKey: string;
	disUser: string;
	category: number;
	categories: { id: number; name: string }[];
	categories_to_sync: { id: number; name: string }[];
}

export const DEFAULT_SETTINGS: DiscourseSyncSettings = {
	baseUrl: "https://yourforum.example.com",
	apiKey: "apikey",
	disUser: "DiscourseUsername",
	category: 1,
	categories: [],
	categories_to_sync: []
};

export class DiscourseSyncSettingsTab extends PluginSettingTab {
	plugin: DiscourseSyncPlugin;
	constructor(app: App, plugin: DiscourseSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
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

		new Setting(containerEl)
			.setName("Categories to Sync")
			.setDesc("Select categories to sync for offline viewing.")
			.addButton((button: ButtonComponent) => {
				button.setButtonText("Fetch")
					.setCta()
					.onClick(async () => {
						const categories = await this.plugin.fetchCategories();
						this.plugin.settings.categories = categories;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		if (this.plugin.settings.categories.length > 0) {
			const categoryList = containerEl.createEl("div");
			this.plugin.settings.categories.forEach((category) => {
				const listItem = categoryList.createEl("div", { cls: 'category-item' });
				const checkbox = listItem.createEl("input", { type: "checkbox" });

				if (this.plugin.settings.categories_to_sync.some((cat) => cat.id === category.id)) {
					checkbox.checked = true;
				}

				listItem.createEl("span", { text: category.name });

				checkbox.addEventListener("change", async () => {
					if (checkbox.checked) {
						this.plugin.settings.categories_to_sync.push(category);
					} else {
						this.plugin.settings.categories_to_sync = this.plugin.settings.categories_to_sync.filter((cat) => cat.id !== category.id);
					}
					await this.plugin.saveSettings();
				});
			});
			new Setting(containerEl)
				.addButton((button: ButtonComponent) => {
					button.setButtonText("Sync")
						.setCta()
						.onClick(async () => {
							await this.plugin.syncCategories();
						});
				});
		}
	}
}
