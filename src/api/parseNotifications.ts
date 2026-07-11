import type { NotificationKind, NotificationsPage, Tweet, XNotification, XUser } from "../types/x";
import { parseTweetResult, parseUser } from "./parse";

// X's v2 notifications/all.json returns a globalObjects bag (users, tweets) plus
// a timeline of entry instructions that reference those objects by id. This flattens
// that graph into `XNotification[]`. Isolated from the GraphQL parser because the
// v2 shape is entirely different (id-referenced globalObjects, not inline results).

/* eslint-disable @typescript-eslint/no-explicit-any */

function num(value: any, fallback: number): number {
	return typeof value === "number" ? value : fallback;
}

function str(value: any, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

// v2 users are the raw legacy object keyed by id; wrap them so parseUser (which
// expects a GraphQL user_results.result shape) can read them uniformly.
function userFromGlobal(rawUser: any, id: string): XUser {
	if (!rawUser) return { id: id, handle: "", name: "", avatarUrl: "", verified: false };
	return parseUser({
		result: { rest_id: id, legacy: rawUser, is_blue_verified: rawUser.ext_is_blue_verified }
	});
}

// Map X's notification icon/template id to our coarse kind.
function kindFromEntry(entry: any): NotificationKind {
	const iconId = entry && entry.icon && entry.icon.id ? entry.icon.id : "";
	if (iconId.indexOf("heart") !== -1 || iconId.indexOf("favorite") !== -1) return "like";
	if (iconId.indexOf("retweet") !== -1) return "retweet";
	if (iconId.indexOf("person") !== -1 || iconId.indexOf("follow") !== -1) return "follow";
	if (iconId.indexOf("mention") !== -1 || iconId.indexOf("reply") !== -1) return "mention";
	return "other";
}

function messageText(entry: any): string {
	if (entry && entry.message && typeof entry.message.text === "string") return entry.message.text;
	return "";
}

export function parseNotifications(response: any): NotificationsPage {
	const globals = (response && response.globalObjects) || {};
	const usersById = globals.users || {};
	const tweetsById = globals.tweets || {};
	const timeline = (response && response.timeline) || {};
	const instructions = timeline.instructions || [];

	const items: XNotification[] = [];
	let cursor: string | undefined;

	// The tweet objects in globalObjects are legacy-only; wrap each so the shared
	// tweet parser can normalize it (with its author looked up from usersById).
	function tweetById(id: string): Tweet | undefined {
		const raw = tweetsById[id];
		if (!raw) return undefined;
		const authorId = str(raw.user_id_str, "");
		const wrapped = {
			rest_id: id,
			legacy: raw,
			core: { user_results: { result: { rest_id: authorId, legacy: usersById[authorId] || {} } } },
			views: raw.ext_views ? { count: str(raw.ext_views.count, "0") } : undefined
		};
		return parseTweetResult(wrapped) || undefined;
	}

	for (let i = 0; i < instructions.length; i++) {
		const entries =
			instructions[i] && (instructions[i].addEntries ? instructions[i].addEntries.entries : null);
		if (!Array.isArray(entries)) continue;
		for (let j = 0; j < entries.length; j++) {
			const entry = entries[j];
			const content = entry && entry.content;
			if (!content) continue;

			if (content.operation && content.operation.cursor) {
				if (content.operation.cursor.cursorType === "Top")
					cursor = str(content.operation.cursor.value, undefined);
				continue;
			}

			const item = content.item;
			if (!item || !item.content) continue;
			const notif = item.content.notification || item.content.tweet;

			// A notification entry references a notification object in globalObjects.
			const notifId = notif && notif.id ? notif.id : entry.entryId;
			const notifObj = (globals.notifications || {})[notifId];
			if (notifObj) {
				const fromUserIds: string[] = notifObj.fromUsers || [];
				items.push({
					id: str(notifId, String(j)),
					kind: kindFromEntry(notifObj),
					createdAt: num(parseInt(notifObj.timestampMs, 10), 0),
					text: messageText(notifObj),
					users: fromUserIds.map(function (uid: string) {
						return userFromGlobal(usersById[uid], uid);
					}),
					tweet: notifObj.tweetId ? tweetById(str(notifObj.tweetId, "")) : undefined
				});
				continue;
			}

			// A bare tweet entry (a mention/reply surfaced directly) → treat as mention.
			if (item.content.tweet && item.content.tweet.id) {
				const t = tweetById(item.content.tweet.id);
				if (t) {
					items.push({
						id: "tweet-" + item.content.tweet.id,
						kind: "mention",
						createdAt: t.createdAt,
						text: "",
						users: [t.author],
						tweet: t
					});
				}
			}
		}
	}

	return { items: items, cursor: cursor, unreadCount: 0 };
}
