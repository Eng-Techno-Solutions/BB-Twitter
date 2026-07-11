import type { FontSizeKey, ThemeMode } from "../theme";
import type { XAccount } from "../types/app";
import { STORAGE_KEYS } from "./constants";
import type { AsyncStorageInterface } from "./types";
import { Platform } from "react-native";

export type { XAccount as Account };

function getAsyncStorage(): AsyncStorageInterface {
	return require("react-native").AsyncStorage;
}

async function getItem(key: string): Promise<string | null> {
	if (Platform.OS === "web") {
		return localStorage.getItem(key);
	}
	return await getAsyncStorage().getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
	if (Platform.OS === "web") {
		localStorage.setItem(key, value);
	} else {
		await getAsyncStorage().setItem(key, value);
	}
}

async function removeItem(key: string): Promise<void> {
	if (Platform.OS === "web") {
		localStorage.removeItem(key);
	} else {
		await getAsyncStorage().removeItem(key);
	}
}

export async function saveToken(token: string): Promise<void> {
	await setItem(STORAGE_KEYS.AUTH_TOKEN, token);
}

export async function getToken(): Promise<string | null> {
	return await getItem(STORAGE_KEYS.AUTH_TOKEN);
}

export async function clearToken(): Promise<void> {
	await removeItem(STORAGE_KEYS.AUTH_TOKEN);
	await removeItem(STORAGE_KEYS.CSRF_TOKEN);
}

// X session is a pair: auth_token (identity) + ct0 (CSRF). Stored/read/cleared
// together — a lone auth_token is useless for authenticated requests.
export interface XSession {
	authToken: string;
	csrf: string;
}

export async function saveSession(session: XSession): Promise<void> {
	await setItem(STORAGE_KEYS.AUTH_TOKEN, session.authToken);
	await setItem(STORAGE_KEYS.CSRF_TOKEN, session.csrf);
}

export async function getSession(): Promise<XSession | null> {
	const authToken = await getItem(STORAGE_KEYS.AUTH_TOKEN);
	const csrf = await getItem(STORAGE_KEYS.CSRF_TOKEN);
	if (!authToken || !csrf) return null;
	return { authToken: authToken, csrf: csrf };
}

export async function saveTheme(mode: ThemeMode): Promise<void> {
	await setItem(STORAGE_KEYS.THEME, mode);
}

export async function getTheme(): Promise<ThemeMode> {
	const val = await getItem(STORAGE_KEYS.THEME);
	return (val as ThemeMode) || "dark";
}

export async function saveNotifInterval(ms: number): Promise<void> {
	await setItem(STORAGE_KEYS.NOTIF_INTERVAL, String(ms));
}

export async function getNotifInterval(): Promise<number> {
	const val = await getItem(STORAGE_KEYS.NOTIF_INTERVAL);
	return val ? parseInt(val, 10) : 120000;
}

export async function saveNotifEnabled(enabled: boolean): Promise<void> {
	await setItem(STORAGE_KEYS.NOTIF_ENABLED, enabled ? "1" : "0");
}

export async function getNotifEnabled(): Promise<boolean> {
	const val = await getItem(STORAGE_KEYS.NOTIF_ENABLED);
	return val !== "0";
}

export async function saveSoundEnabled(enabled: boolean): Promise<void> {
	await setItem(STORAGE_KEYS.SOUND_ENABLED, enabled ? "1" : "0");
}

export async function getSoundEnabled(): Promise<boolean> {
	const val = await getItem(STORAGE_KEYS.SOUND_ENABLED);
	return val !== "0";
}

export async function saveFontSize(size: FontSizeKey): Promise<void> {
	await setItem(STORAGE_KEYS.FONT_SIZE, size);
}

export async function getFontSize(): Promise<FontSizeKey> {
	const val = await getItem(STORAGE_KEYS.FONT_SIZE);
	return (val as FontSizeKey) || "medium";
}

export async function getAccounts(): Promise<XAccount[]> {
	const val = await getItem(STORAGE_KEYS.ACCOUNTS);
	if (!val) return [];
	try {
		return JSON.parse(val) as XAccount[];
	} catch (e) {
		return [];
	}
}

export async function saveAccounts(accounts: XAccount[]): Promise<void> {
	await setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
}

export async function getActiveAccountId(): Promise<string | null> {
	const val = await getItem(STORAGE_KEYS.ACTIVE_ACCOUNT);
	return val || null;
}

export async function saveActiveAccountId(id: string): Promise<void> {
	await setItem(STORAGE_KEYS.ACTIVE_ACCOUNT, id);
}
