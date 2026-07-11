import type { DMConversation, DMMessage, XUser } from "../types/x";

// X's DM endpoints return an inbox graph: a `users` map, a `conversations` map,
// and an `entries` array of message/event objects that reference them by id.
// This flattens that into DMConversation[] / DMMessage[]. Kept separate from the
// tweet parsers — the DM shape shares nothing with them.

/* eslint-disable @typescript-eslint/no-explicit-any */

function str(value: any, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

// DM user objects are flat twitter user records, not GraphQL results.
function dmUser(raw: any): XUser {
	if (!raw) return { id: "", handle: "", name: "", avatarUrl: "", verified: false };
	return {
		id: str(raw.id_str, String(raw.id || "")),
		handle: str(raw.screen_name, ""),
		name: str(raw.name, ""),
		avatarUrl: str(raw.profile_image_url_https, "").replace("_normal", "_400x400"),
		verified: Boolean(raw.verified || raw.ext_is_blue_verified)
	};
}

function messageFromEntry(entry: any): DMMessage | null {
	const m = entry && entry.message;
	if (!m || !m.message_data) return null;
	const data = m.message_data;
	const media =
		data.attachment && data.attachment.photo
			? {
					type: "photo" as const,
					url: str(data.attachment.photo.media_url_https, "")
				}
			: undefined;
	return {
		id: str(m.id, ""),
		conversationId: str(m.conversation_id, ""),
		senderId: str(data.sender_id, ""),
		text: str(data.text, ""),
		createdAt: parseInt(str(data.time, "0"), 10) || 0,
		media: media
	};
}

// Root differs between the inbox call and a single-conversation call; accept both.
function inboxRoot(response: any): any {
	return (response && (response.inbox_initial_state || response.inbox_timeline)) || response || {};
}

export function parseInbox(response: any, selfUserId: string): DMConversation[] {
	const root = inboxRoot(response);
	const usersById = root.users || {};
	const conversationsById = root.conversations || {};
	const entries: any[] = root.entries || [];

	// Latest message per conversation, derived from the entries stream.
	const lastByConv: Record<string, DMMessage> = {};
	for (let i = 0; i < entries.length; i++) {
		const msg = messageFromEntry(entries[i]);
		if (!msg || !msg.conversationId) continue;
		const prev = lastByConv[msg.conversationId];
		if (!prev || msg.createdAt >= prev.createdAt) lastByConv[msg.conversationId] = msg;
	}

	const conversations: DMConversation[] = [];
	const ids = Object.keys(conversationsById);
	for (let i = 0; i < ids.length; i++) {
		const conv = conversationsById[ids[i]];
		const participantIds: string[] = (conv.participants || []).map(function (p: any) {
			return str(p.user_id, "");
		});
		const participants = participantIds
			.filter(function (id: string) {
				return id !== selfUserId; // show the OTHER party, like X's inbox
			})
			.map(function (id: string) {
				return dmUser(usersById[id]);
			});
		conversations.push({
			id: ids[i],
			participants: participants.length
				? participants
				: participantIds.map(function (id) {
						return dmUser(usersById[id]);
					}),
			lastMessage: lastByConv[ids[i]],
			unread: Number(conv.last_read_event_id || 0) < Number(conv.max_entry_id || 0)
		});
	}

	// Most recent conversation first.
	conversations.sort(function (a, b) {
		const at = a.lastMessage ? a.lastMessage.createdAt : 0;
		const bt = b.lastMessage ? b.lastMessage.createdAt : 0;
		return bt - at;
	});
	return conversations;
}

export function parseConversation(response: any): DMMessage[] {
	const timeline = (response && response.conversation_timeline) || response || {};
	const entries: any[] = timeline.entries || [];
	const messages: DMMessage[] = [];
	for (let i = 0; i < entries.length; i++) {
		const msg = messageFromEntry(entries[i]);
		if (msg) messages.push(msg);
	}
	// Oldest → newest for a chat transcript.
	messages.sort(function (a, b) {
		return a.createdAt - b.createdAt;
	});
	return messages;
}
