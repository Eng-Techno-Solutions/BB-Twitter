// HTTP-bridge types shared by http.ts and the native HttpModule. The Slack API
// types that used to live here were removed with the domain cutover.

export interface HttpModuleInterface {
	request(method: string, url: string, headers: string, body: string): Promise<string>;
	uploadMultipart(
		url: string,
		token: string,
		fields: string,
		name: string,
		type: string,
		base64: string
	): Promise<string>;
	uploadBinary(url: string, fileBase64: string, contentType: string): Promise<string>;
	downloadFile(url: string, token: string, destPath: string): Promise<void>;
}

export interface HttpResponse {
	status: number;
	body: string;
}

export interface FileData {
	name?: string;
	type?: string;
	size?: number;
	base64?: string;
	file?: File;
	blob?: Blob;
}
