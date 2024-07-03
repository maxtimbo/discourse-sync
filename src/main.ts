import { App, Menu, MenuItem, Plugin, Modal, requestUrl, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, DiscourseSyncSettings, DiscourseSyncSettingsTab } from './config';
import Axios from "axios";
//import fs from "fs";
//import * as crypto from "crypto";

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

	// CORS Error
	async uploadFetchImages(imageReferences: string[]): Promise<string[]> {
		const imageUrls: string[] = [];
		for (const ref of imageReferences) {
			const filePath = this.app.metadataCache.getFirstLinkpathDest(ref, this.activeFile.name)?.path;
			if (filePath) {
				const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
				if (file) {
					try {
						const imgFile = await this.app.vault.readBinary(file);
						const blob = new Blob([imgFile]);

						const formData = new FormData();
						formData.append("type", "composer");
						formData.append("synchronous", "true");
						formData.append("files[]", blob, file.name);

						const url = `${this.settings.baseUrl}/uploads.json`;
						const headers = {
							"Api-Key": this.settings.apiKey,
							"Api-Username": this.settings.disUser,
						};
						try {
							const response = await fetch(url, {
								method: "POST",
								body: formData,
								headers: headers,
								mode: 'cors',
								referrerPolicy: 'no-referrer',
							});
							console.log(response.json());
						} catch (error) {
							console.log('Fetch error: ' + error);
						}
					} catch (error) {
						console.log('Gather error: ' + error);
					}
				}
			}
		}
		return imageUrls;
	}


	// CORS Error
	async uploadAxiosImages(imageReferences: string[]): Promise<string[]> {
		const imageUrls: string[] = [];
		for (const ref of imageReferences) {
			const filePath = this.app.metadataCache.getFirstLinkpathDest(ref, this.activeFile.name)?.path;
			if (filePath) {
				const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
				if (file) {
					try {
						const imgFile = await this.app.vault.readBinary(file);
						const blob = new Blob([imgFile]);
						const url = `${this.settings.baseUrl}/uploads.json`;
						const form = new FormData();
						form.append("type", "composer");
						form.append("synchronous", "true");
						form.append("files[]", blob, file.name);
						const headers = {
							"Api-Key": this.settings.apiKey,
							"Api-Username": this.settings.disUser,
							"Content-Type": "multipart/form-data",
						};

						const response = await Axios.post(url, form, { headers });
						console.log(JSON.stringify(response.data));
						imageUrls.push("empty");

						

					} catch (error) {
						console.error("Error: " + error);
					}
				}
			}
		}
		return imageUrls;
	}

	// URL not found error
	async uploadExternalImage(imageReferences: string[]): Promise<string[]> {
		const imageUrls: string[] = [];
		for (const ref of imageReferences) {
			const filePath = this.app.metadataCache.getFirstLinkpathDest(ref, this.activeFile.name)?.path;
			if (filePath) {
				const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
				if (file) {
					try {
						const url = `${this.settings.baseUrl}/uploads/generate-presigned-put.json`;
						//const imgfile = await this.app.vault.readBinary(file);
						const img = {
							type: "composer",
							file_name: file.name,
							file_size: file.stat.size,
						}
						console.log(JSON.stringify(img));
						const headers = {
							"Content-Type": "application/json",
							"Api-Key": this.settings.apiKey,
							"Api-Username": this.settings.disUser,
						};
						const response = await requestUrl({
							url: url,
							method: "POST",
							body: JSON.stringify(img),
							throw: false,
							headers: headers
						})
						console.log(response.json)
					} catch (error) {
						console.error(`Error uploading: ${error}`);
						//console.log(response.json)
					}
				} else {
					console.error('error')
				}
			} else {
				console.error('error')
			}
		}
		return imageUrls;
	}

	// Incorrect params error
	async uploadImages(imageReferences: string[]): Promise<string[]> {
		const imageUrls = [];
		for (const ref of imageReferences) {
			const filePath = this.app.metadataCache.getFirstLinkpathDest(ref, this.activeFile.name)?.path;
			if (filePath) {
				const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
				if (file) {
					try {
						const imgfile = await this.app.vault.readBinary(file);
						const boundary = genBoundary();
						const sBoundary = '--' + boundary + '\r\n';
						let body = '';
						body += `${sBoundary}Content-Disposition: form-data; name="type"\r\n\r\ncomposer\r\n`;
						body += `${sBoundary}Content-Disposition: form-data; name="synchronous"\r\n\r\ntrue\r\n`;
						body += `${sBoundary}Content-Disposition: form-data; name="files[]"; filename="${file.name}"\r\nContent-Type: image/jpg\r\n`;

						const eBoundary = '\r\n--' + boundary + '--\r\n';
						const bodyArray = new TextEncoder().encode(body);
						const endBoundaryArray = new TextEncoder().encode(eBoundary);

						const formDataArray = new Uint8Array(bodyArray.length + imgfile.byteLength + endBoundaryArray.length);
						formDataArray.set(bodyArray, 0);
						formDataArray.set(new Uint8Array(imgfile), bodyArray.length);
						formDataArray.set(endBoundaryArray, bodyArray.length + imgfile.byteLength);

						const url = `${this.settings.baseUrl}/uploads.json`;
						const headers = {
							"Api-Key": this.settings.apiKey,
							"Api-Username": this.settings.disUser,
							"Content-Type": `multipart/form-data; boundary=${boundary}`
						};

						const response = await requestUrl({
							url: url,
							method: "POST",
							body: formDataArray,
							throw: false,
							headers: headers,
						});

						if (response.status == 200) {
							const jsonResponse = response.json();
							console.log(`Upload Image jsonResponse: ${JSON.stringify(jsonResponse)}`);
							imageUrls.push(jsonResponse.url);
						} else {
							new NotifyUser(this.app, `Error uploading image: ${response.status}`).open();
							console.error(`Error uploading image: ${JSON.stringify(response.json)}`);
						}
					} catch (error) {
						new NotifyUser(this.app, `Exception while uploading image: ${error}`).open();
						console.error("Exception while uploading image:", error);
					}
				} else {
					new NotifyUser(this.app, `File not found in vault: ${ref}`).open();
					console.error(`File not found in vault: ${ref}`);
				}
			} else {
				new NotifyUser(this.app, `Unable to resolve file path for: ${ref}`).open();
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
		const imageUrls = await this.uploadFetchImages(imageReferences);
		//const imageUrls = await this.uploadAxiosImages(imageReferences);
		//const imageUrls = await this.uploadExternalImage(imageReferences);
		//const imageUrls = await this.uploadImages(imageReferences);

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

		//const response = await requestUrl({
		//	url: url,
		//	method: "POST",
		//	contentType: "application/json",
		//	body,
		//	headers,
		//});

		//if (response.status !== 200) {
		//	console.error("Error publishing to Discourse:", response.status);
		//	console.error("Response body:", response.text);
		//	if (response.status == 422) {
		//		new NotifyUser(this.app, `There's an error with this post, could be a duplicate or the title is too short: ${response.status}`).open();

		//		console.error("there's an error with this post, try making a longer title");
		//	}
		//	return { message: "Error publishing to Discourse" };
		//}
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
			const allCategories = categories.flatMap((category: Category) => {
				const subcategories: { id: number; name: string }[] = category.subcategory_list?.map((sub: Subcategory) => ({
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

interface Subcategory {
	id: number;
	name: string;
}

interface Category {
	id: number;
	name: string;
	subcategory_list?: Subcategory[];
}

interface PresignedImage {
	type: string;
	file_name: string;
	file_size: number;
}

const genBoundary = (): string => {
	return '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
}


export class NotifyUser extends Modal {
	message: string;
	constructor(app: App, message: string) {
		super(app);
		this.message = message;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h1", { text: 'An error has occurred.' });
		contentEl.createEl("h4", { text: this.message });
		const okButton = contentEl.createEl('button', { text: 'Ok' });
		okButton.onclick = () => {
			this.close();
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

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
