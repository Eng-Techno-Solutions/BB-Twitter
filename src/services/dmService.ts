import { parseConversation, parseInbox } from "../api/parseDM";
import type XAPI from "../api/xapi";
import type { DMConversation, DMMessage } from "../types/x";

// Data-access seam for direct messages. Screens call these; the DM-graph shape
// stays here (mirrors timelineLoader / notificationsService).

export async function loadInbox(api: XAPI, selfUserId: string): Promise<DMConversation[]> {
	const response = await api.dmInbox();
	return parseInbox(response, selfUserId);
}

export async function loadConversation(api: XAPI, conversationId: string): Promise<DMMessage[]> {
	const response = await api.dmConversation(conversationId);
	return parseConversation(response);
}

export async function sendMessage(api: XAPI, conversationId: string, text: string): Promise<void> {
	await api.dmSend(conversationId, text);
}
