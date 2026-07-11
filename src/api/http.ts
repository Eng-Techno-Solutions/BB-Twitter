import type { FileData, HttpModuleInterface, HttpResponse } from "./types";
import { NativeModules } from "react-native";

const HttpModule = NativeModules.HttpModule as HttpModuleInterface | undefined;

export function request(
	method: string,
	url: string,
	headers: Record<string, string>,
	body: string
): Promise<HttpResponse> {
	if (HttpModule && HttpModule.request) {
		return HttpModule.request(method, url, JSON.stringify(headers || {}), body || "").then(function (
			res: string
		): HttpResponse {
			return JSON.parse(res);
		});
	}

	// Fallback to fetch for dev testing on regular Android
	const opts: RequestInit = {
		method: method,
		headers: headers || {}
	};
	if (body && method !== "GET") {
		opts.body = body;
	}
	return fetch(url, opts).then(function (res: Response): Promise<HttpResponse> {
		return res.text().then(function (text: string): HttpResponse {
			return { status: res.status, body: text };
		});
	});
}

export function uploadFile(
	url: string,
	token: string,
	fields: Record<string, string>,
	fileData: FileData
): Promise<HttpResponse> {
	// fileData: { name, type, base64 } (Android) or { name, type, file/blob } (Web)
	if (HttpModule && HttpModule.uploadMultipart) {
		return HttpModule.uploadMultipart(
			url,
			token,
			JSON.stringify(fields),
			fileData.name,
			fileData.type,
			fileData.base64 || ""
		).then(function (res: string): HttpResponse {
			return JSON.parse(res);
		});
	}

	// Web fallback using FormData
	const formData = new FormData();
	const keys = Object.keys(fields);
	for (let i = 0; i < keys.length; i++) {
		formData.append(keys[i], fields[keys[i]]);
	}
	if (fileData.file || fileData.blob) {
		formData.append("file", (fileData.file || fileData.blob) as Blob, fileData.name);
	}
	return fetch(url, {
		method: "POST",
		headers: { Authorization: "Bearer " + token },
		body: formData
	}).then(function (res: Response): Promise<HttpResponse> {
		return res.text().then(function (text: string): HttpResponse {
			return { status: res.status, body: text };
		});
	});
}

export function uploadBinary(
	url: string,
	fileBase64: string,
	contentType: string
): Promise<HttpResponse> {
	if (HttpModule && HttpModule.uploadBinary) {
		return HttpModule.uploadBinary(url, fileBase64, contentType).then(function (
			res: string
		): HttpResponse {
			return JSON.parse(res);
		});
	}

	// Web fallback: decode base64 and POST as blob
	const binary = atob(fileBase64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	const blob = new Blob([bytes], { type: contentType });
	return fetch(url, {
		method: "POST",
		body: blob
	}).then(function (res: Response): Promise<HttpResponse> {
		return res.text().then(function (text: string): HttpResponse {
			return { status: res.status, body: text };
		});
	});
}
