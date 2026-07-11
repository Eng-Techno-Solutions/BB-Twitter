import type { FilePickerModuleInterface, PickedFile } from "./types";
import { NativeModules } from "react-native";

const FilePickerModule = NativeModules.FilePickerModule as FilePickerModuleInterface | undefined;

export function pickFile(): Promise<PickedFile | null> {
	if (!FilePickerModule) {
		return Promise.reject(new Error("FilePickerModule not available"));
	}
	return FilePickerModule.pickFile().then(function (result: string): PickedFile | null {
		if (result === "cancelled") return null;
		const data = JSON.parse(result);
		return {
			name: data.name,
			type: data.type,
			size: data.size,
			base64: data.base64
		};
	});
}
