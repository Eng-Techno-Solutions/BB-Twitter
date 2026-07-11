import { parseUser } from "../api/parse";
import XAPI from "../api/xapi";
import type { XUser } from "../types/x";
import type { XSession } from "../utils/storage";

/* eslint-disable @typescript-eslint/no-explicit-any */

// X session auth, the analog of BBSlack's authService. There is no email/password
// call here by default — the reliable path is a pasted session (auth_token + ct0),
// mirroring BBSlack's "Token method". The GraphQL `Viewer` query both validates the
// session and hands back the signed-in identity (like Slack's auth.test).

export interface VerifiedIdentity {
	user: XUser;
}

// Accepts either two raw values or a pasted cookie/header blob and extracts the
// auth_token + ct0 pair. Users commonly copy the whole Cookie header, so we parse
// it defensively rather than demanding an exact format (UX first line of defense).
export function parseSessionInput(rawAuthToken: string, rawCsrf: string): XSession | null {
	const authToken = extractCookieValue(rawAuthToken, "auth_token");
	const csrf = extractCookieValue(rawCsrf || rawAuthToken, "ct0");
	if (!authToken || !csrf) return null;
	return { authToken: authToken, csrf: csrf };
}

// Pulls `name=value` out of a cookie-ish string, or returns the trimmed input if
// it's already a bare value (no `name=` present).
function extractCookieValue(input: string, name: string): string {
	const value = (input || "").trim();
	if (!value) return "";
	const match = value.match(new RegExp("(?:^|;\\s*)" + name + "=([^;\\s]+)"));
	if (match) return match[1];
	// Bare token pasted directly (only meaningful when it isn't the other cookie).
	return value.indexOf("=") === -1 ? value : "";
}

// Pulls the User node out of the Viewer GraphQL response
// (data.viewer.user_results.result) and flattens it with the shared parser.
function identityFromViewer(data: any): XUser {
	const userResults = data && data.data && data.data.viewer && data.data.viewer.user_results;
	return parseUser(userResults);
}

// Validates a session against X and returns the identity behind it. Throws with a
// user-facing message on failure — never returns a half-populated identity.
export async function verifySession(session: XSession): Promise<VerifiedIdentity> {
	const api = new XAPI(session);
	const data = await api.viewer();
	const user = identityFromViewer(data);
	if (!user.id || !user.handle) {
		throw new Error("Could not verify this session. Check your auth_token and ct0.");
	}
	return { user: user };
}
