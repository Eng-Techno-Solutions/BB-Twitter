export interface AsyncStorageInterface {
	setItem(key: string, value: string): Promise<void>;
	getItem(key: string): Promise<string | null>;
	removeItem(key: string): Promise<void>;
}

export interface NotificationModuleInterface {
	startService(token: string, userId: string, usersJson: string, intervalMs: number): void;
	stopService(): void;
	setAppForeground(foreground: boolean): void;
	showNotification(title: string, body: string, channelId: string | null): void;
	cancelAll(): void;
	clearUnreadTracking(): void;
}

export interface AudioRecorderModuleInterface {
	startRecording(): Promise<string>;
	stopRecording(): Promise<string>;
	cancelRecording(): Promise<void>;
}

export interface RecordingResult {
	base64: string;
	duration: number;
	name: string;
	type: string;
}

export interface WebRecordingResult {
	blob: Blob;
	duration: number;
	name: string;
	type: string;
}

export interface AudioDownloadHttpModule {
	downloadFile(url: string, token: string, destPath: string): Promise<void>;
}

export interface DocumentHttpModule {
	downloadFile(url: string, token: string, destPath: string): Promise<void>;
	openFile(path: string, mimeType: string): Promise<boolean>;
}

export interface RNFSDownloadResult {
	statusCode: number;
}

export interface RNFSModule {
	CachesDirectoryPath: string;
	ExternalStorageDirectoryPath: string | null;
	mkdir(path: string): Promise<void>;
	downloadFile(options: { fromUrl: string; toFile: string; headers: Record<string, string> }): {
		promise: Promise<RNFSDownloadResult>;
	};
	unlink(path: string): Promise<void>;
}

export type AudioDownloadCallback = (error: string | null, path: string | null) => void;

export interface SoundInstance {
	play(onEnd?: (success: boolean) => void): void;
	stop(onStop?: () => void): void;
}

export interface SoundConstructor {
	new (filename: string, basePath: string, onError?: (error: Error | null) => void): SoundInstance;
	MAIN_BUNDLE: string;
	setCategory(category: string): void;
}

export interface FilePickerModuleInterface {
	pickFile(): Promise<string>;
}

export interface PickedFile {
	name: string;
	type: string;
	size: number;
	base64: string;
}

export interface PickedWebFile {
	name: string;
	type: string;
	size: number;
	file: File;
}
