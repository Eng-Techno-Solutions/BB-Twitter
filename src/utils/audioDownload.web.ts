import type { AudioDownloadCallback } from "./types";

function downloadAudio(url: string, token: string, callback: AudioDownloadCallback): void {
	callback(null, url);
}

function cleanupFile(): void {}

export default { downloadAudio: downloadAudio, cleanupFile: cleanupFile };
