import type XAPI from "../api/xapi";
import { pickFile } from "../utils/filePicker";

// Image attach flow for Compose: pick a file, upload it, hand back the media id
// plus a data-URI preview. Android-only in practice — the picker yields base64
// there, and X's upload host needs the cookie/csrf auth the web fetch can't send.

export interface AttachedMedia {
	mediaId: string;
	previewUri: string;
}

export async function pickAndUploadImage(api: XAPI): Promise<AttachedMedia | null> {
	const picked = await pickFile();
	if (!picked) return null;
	// Only the native picker provides base64; without it we can't upload.
	const base64 = (picked as { base64?: string }).base64;
	const type = picked.type || "image/jpeg";
	if (!base64) throw new Error("This platform can't attach images. Use the device build.");
	const mediaId = await api.uploadMediaSimple(base64, type);
	return { mediaId: mediaId, previewUri: "data:" + type + ";base64," + base64 };
}
