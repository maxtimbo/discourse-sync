import { App, Menu, MenuItem, Plugin, Modal, requestUrl, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, DiscourseSyncSettings, DiscourseSyncSettingsTab } from './config';

export default class DiscourseSyncPlugin extends Plugin {
	settings: DiscourseSyncSettings;
	activeFile: { name: string; content: string };
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new DiscourseSyncSettingsTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file: TFile) => {
				this.registerDirMenu(menu, file);
			}),
		);

		this.addCommand({
			id: "category-modal",
			name: "Category Modal",
			callback: () => {
				this.openCategoryModal();
			},
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	extractImageReferences(content: string): string[] {
		const regex = /!\[\[(.*?)\]\]/g;
		const matches = [];
		let match;
		while ((match = regex.exec(content)) !== null) {
			matches.push(match[1]);
		}
		console.log("matches:", matches);
		return matches;
	}

	async uploadImages(imageReferences: string[]): Promise<string[]> {
		const imageUrls = [];
		for (const ref of imageReferences) {
			const filePath = this.app.metadataCache.getFirstLinkpathDest(ref, this.activeFile.name)?.path;
			if (filePath) {
				const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
				if (file) {
					try {
						const arrayBuffer = await this.app.vault.readBinary(file);
						const formData = new FormData();
						formData.append("file", new Blob([arrayBuffer]), file.name);
						formData.append("type", "composer");

						const url = `${this.settings.baseUrl}/uploads.json`;
						const headers = {
							"Api-Key": this.settings.apiKey,
							"Api-Username": this.settings.disUser,
						};

						const response = await fetch(url, {
							method: "POST",
							body: formData,
							headers: new Headers(headers),
						});

						console.log(`Upload Image response: ${response.status}`);
						if (response.ok) {
							const jsonResponse = response.json();
							console.log(`Upload Image jsonResponse: ${JSON.stringify(jsonResponse)}`);
							imageUrls.push(jsonResponse.url);
						} else {
							console.error("Error uploading image:", response.status, await response.text());
						}
					} catch (error) {
						console.error("Exception while uploading image:", error);
					}
				} else {
					console.error(`File not found in vault: ${ref}`);
				}
			} else {
				console.error(`Unable to resolve file path for: ${ref}`);
			}
		}
		return imageUrls;
	}

	async postTopic(): Promise<{ message: string }> {
		const url = `${this.settings.baseUrl}/posts.json`;
		const headers = {
			"Content-Type": "application/json",
			"Api-Key": this.settings.apiKey,
			"Api-Username": this.settings.disUser,
		}
		let content = this.activeFile.content;
		const imageReferences = this.extractImageReferences(content);
		const imageUrls = await this.uploadImages(imageReferences);

		imageReferences.forEach((ref, index) => {
			const obsRef = `![[${ref}]]`;
			const discoRef = `![${ref}](${imageUrls[index]})`;
			content = content.replace(obsRef, discoRef);
		});

		const body = JSON.stringify({
			title: this.activeFile.name,
			raw: content,
			category: this.settings.category
		});
		console.log("POST Body:", body);

		const response = await requestUrl({
			url: url,
			method: "POST",
			contentType: "application/json",
			body,
			headers,
		});

		if (response.status !== 200) {
			console.error("Error publishing to Discourse:", response.status);
			console.error("Response body:", response.text);
			if (response.status == 422) {
				console.error("there's an error with this post, try making a longer title");
			}
			return { message: "Error publishing to Discourse" };
		}

		//const jsonResponse = response.json;
		//console.log(`jsonResponse: ${JSON.stringify(jsonResponse, null, 2)}`);
		return { message: "Success" };
	}

	private async fetchCategories() {
		const url = `${this.settings.baseUrl}/categories.json?include_subcategories=true`;
		const headers = {
			"Content-Type": "application/json",
			"Api-Key": this.settings.apiKey,
			"Api-Username": this.settings.disUser,
		};

		try {
			const response = await requestUrl({
				url: url,
				method: "GET",
				contentType: "application/json",
				headers,
			});


			const data = await response.json;
			const categories = data.category_list.categories;
			const allCategories = categories.flatMap((category: any) => {
				const subcategories = category.subcategory_list?.map((sub: any) => ({
					id: sub.id,
					name: sub.name,
				})) || [];
				return [
					{ id: category.id, name: category.name },
					...subcategories,
				];
			});
			return allCategories;
		} catch (error) {
			console.error("Error fetching categories:", error);
			return [];
		}
	}

	registerDirMenu(menu: Menu, file: TFile) {
		const syncDiscourse = (item: MenuItem) => {
			item.setTitle("Sync to Discourse");
			item.onClick(async () => {
				this.activeFile = {
					name: file.basename,
					content: await this.app.vault.read(file)
				};
				await this.syncToDiscourse();
			});
		}
		menu.addItem(syncDiscourse)
	}

	private async openCategoryModal() {
		const categories = await this.fetchCategories();
		if (categories.length > 0) {
			new SelectCategoryModal(this.app, this, categories).open();
		} else {
			console.error("No categories");
		}
	}


	private async syncToDiscourse() {
		await this.openCategoryModal();
	}

	onunload() {}

}

export class SelectCategoryModal extends Modal {
	plugin: DiscourseSyncPlugin;
	categories: {id: number; name: string}[];
	constructor(app: App, plugin: DiscourseSyncPlugin, categories: {id: number; name: string }[]) {
		super(app);
		this.plugin = plugin;
		this.categories = categories
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h1", { text: 'Select a category for syncing' });
		const selectEl = contentEl.createEl('select');

		this.categories.forEach(category => {
			const option = selectEl.createEl('option', { text: category.name });
			option.value = category.id.toString();
		});

		const submitButton = contentEl.createEl('button', { text: 'Submit' });
		submitButton.onclick = async () => {
			const selectedCategoryId = selectEl.value;
			this.plugin.settings.category = parseInt(selectedCategoryId);
			await this.plugin.saveSettings();
			const reply = await this.plugin.postTopic();
			console.log(`postTopic message: ${reply.message}`);
			console.log(`ID: ${selectedCategoryId}`);
			this.close();
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
