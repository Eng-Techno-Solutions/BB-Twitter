import type { XAccount } from "../types/app";
import type { XUser } from "../types/x";
import {
	getAccounts,
	getActiveAccountId,
	getSession,
	logger,
	saveAccounts,
	saveActiveAccountId,
	saveSession
} from "../utils";
import type { XSession } from "../utils/storage";
import { verifySession } from "./authService";

// Multi-account manager, the direct analog of BBSlack's. A "workspace" here is an
// X login; each account stores its own session pair + identity so the switcher
// renders offline and switching is one verify call.

export interface AutoLoginResult {
	accounts: XAccount[];
	session: XSession | null;
}

// On launch: prefer the active stored account's session, else any legacy lone
// session. Returns what to attempt — the caller verifies it.
export async function tryAutoLogin(): Promise<AutoLoginResult> {
	const accounts = await getAccounts();
	if (accounts.length > 0) {
		const activeId = await getActiveAccountId();
		const active =
			(activeId &&
				accounts.find(function (a: XAccount) {
					return a.userId === activeId;
				})) ||
			accounts[0];
		return { accounts: accounts, session: { authToken: active.authToken, csrf: active.csrf } };
	}
	const session = await getSession();
	return { accounts: [], session: session };
}

// Verifies a session and persists it as the live one (analog of performAuth).
export async function authenticate(session: XSession): Promise<XUser> {
	const result = await verifySession(session);
	try {
		await saveSession(session);
	} catch (err: unknown) {
		logger.warn("accountManager.authenticate", "session persistence failed; login continues", err);
	}
	return result.user;
}

export function upsertAccount(accounts: XAccount[], user: XUser, session: XSession): XAccount[] {
	const result = accounts.slice();
	const entry: XAccount = {
		authToken: session.authToken,
		csrf: session.csrf,
		userId: user.id,
		handle: user.handle,
		name: user.name,
		avatarUrl: user.avatarUrl
	};
	const idx = result.findIndex(function (a: XAccount) {
		return a.userId === user.id;
	});
	if (idx >= 0) result[idx] = Object.assign({}, result[idx], entry);
	else result.push(entry);
	return result;
}

export async function persistAccountLogin(accounts: XAccount[], userId: string): Promise<void> {
	try {
		await saveAccounts(accounts);
		await saveActiveAccountId(userId);
	} catch (err: unknown) {
		logger.warn("accountManager.persistAccountLogin", "failed to persist account login", err);
	}
}

export async function removeAccount(accounts: XAccount[], userId: string): Promise<XAccount[]> {
	const filtered = accounts.filter(function (a: XAccount) {
		return a.userId !== userId;
	});
	try {
		await saveAccounts(filtered);
	} catch (err: unknown) {
		logger.warn("accountManager.removeAccount", "failed to persist accounts after remove", err);
	}
	return filtered;
}

export function getResetState(): object {
	return {
		api: null,
		currentUser: null,
		accounts: [],
		stack: [{ screen: "login", params: {} }],
		activeTab: "home"
	};
}
