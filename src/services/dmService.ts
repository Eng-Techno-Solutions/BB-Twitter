import { parseConversation, parseInbox } from "../api/parseDM";
import type XAPI from "../api/xapi";
import type { DMConversation, DMMessage } from "../types/x";

// Data-access seam for direct messages. Screens call these; the DM-graph shape
// stays here (mirrors timelineLoader / notificationsService).

export async function loadInbox(api: XAPI, selfUserId: string): Promise<DMConversation[]> {
	// Trusted inbox is required; the untrusted (message-requests) inbox is a bonus —
	// don't let its failure hide the main inbox.
	const trusted = parseInbox(await api.dmInbox(), selfUserId);
	let untrusted: DMConversation[] = [];
	try {
		untrusted = parseInbox(await api.dmInboxUntrusted(), selfUserId);
	} catch (_err) {
		untrusted = [];
	}

	// Merge, de-duping by conversation id (trusted wins), newest first.
	const byId: Record<string, DMConversation> = {};
	for (let i = 0; i < untrusted.length; i++) byId[untrusted[i].id] = untrusted[i];
	for (let i = 0; i < trusted.length; i++) byId[trusted[i].id] = trusted[i];
	const merged = Object.keys(byId).map(function (id) {
		return byId[id];
	});
	merged.sort(function (a, b) {
		const at = a.lastMessage ? a.lastMessage.createdAt : 0;
		const bt = b.lastMessage ? b.lastMessage.createdAt : 0;
		return bt - at;
	});
	return merged;
}

export async function loadConversation(api: XAPI, conversationId: string): Promise<DMMessage[]> {
	const response = await api.dmConversation(conversationId);
	return parseConversation(response);
}

export async function sendMessage(api: XAPI, conversationId: string, text: string): Promise<void> {
	await api.dmSend(conversationId, text);
}
