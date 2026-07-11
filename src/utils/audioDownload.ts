import { logger } from "./logger";
import type {
	AudioDownloadCallback,
	AudioDownloadHttpModule as HttpModuleInterface,
	RNFSDownloadResult,
	RNFSModule
} from "./types";
import { NativeModules } from "react-native";

const HttpModule = NativeModules.HttpModule as HttpModuleInterface | undefined;
const RNFS: RNFSModule = require("react-native-fs");

function downloadAudio(url: string, token: string, callback: AudioDownloadCallback): void {
	const destPath = RNFS.CachesDirectoryPath + "/bb_audio_" + Date.now() + ".mp4";

	if (HttpModule && HttpModule.downloadFile) {
		HttpModule.downloadFile(url, token, destPath)
			.then(function () {
				callback(null, destPath);
			})
			.catch(function () {
				callback("Failed to download audio", null);
			});
	} else {
		RNFS.downloadFile({
			fromUrl: url,
			toFile: destPath,
			headers: { Authorization: "Bearer " + token }
		})
			.promise.then(function (res: RNFSDownloadResult) {
				if (res.statusCode === 200) {
					callback(null, destPath);
				} else {
					callback("Failed to download audio", null);
				}
			})
			.catch(function () {
				callback("Failed to download audio", null);
			});
	}
}

function cleanupFile(path: string | null): void {
	if (!path) return;
	RNFS.unlink(path).catch(function (err: unknown) {
		logger.warn("audioDownload.cleanupFile", "unlink failed for " + path, err);
	});
}

export default { downloadAudio: downloadAudio, cleanupFile: cleanupFile };
