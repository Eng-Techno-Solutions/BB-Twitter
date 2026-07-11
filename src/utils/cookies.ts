import { NativeModules, Platform } from "react-native";

// Bridge to the native cookie jar (HttpModule.getCookies/clearCookies). Only the
// Android build has a real cookie store — the username/password login flow relies
// on it to read ct0/auth_token after Set-Cookie. Web is a no-op (fetch can't
// expose these, and web is dev-only anyway).

interface CookieModule {
	getCookies(): Promise<string>;
	clearCookies(): Promise<boolean>;
}

function getModule(): CookieModule | undefined {
	if (Platform.OS === "web") return undefined;
	return NativeModules.HttpModule as CookieModule | undefined;
}

export function cookieJarAvailable(): boolean {
	const mod = getModule();
	return Boolean(mod && mod.getCookies);
}

export async function readCookies(): Promise<Record<string, string>> {
	const mod = getModule();
	if (!mod || !mod.getCookies) return {};
	try {
		const json = await mod.getCookies();
		return JSON.parse(json) as Record<string, string>;
	} catch (_err) {
		return {};
	}
}

export async function clearCookies(): Promise<void> {
	const mod = getModule();
	if (!mod || !mod.clearCookies) return;
	try {
		await mod.clearCookies();
	} catch (_err) {
		// Best-effort; a stale guest cookie is not fatal.
	}
}
