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

// X nests a notification's actors and target tweet inside its template, NOT at the
// top level. The common shape is template.aggregateUserActionsV1 with fromUsers
// ([{user:{id}}]) and targetObjects ([{tweet:{id}}]); other templates carry the
// same fields directly. Read defensively across both.
function notificationTemplate(notifObj: any): any {
	const template = notifObj && notifObj.template;
	if (!template) return {};
	return template.aggregateUserActionsV1 || template;
}

function actorIds(notifObj: any): string[] {
	const fromUsers = notificationTemplate(notifObj).fromUsers;
	if (!Array.isArray(fromUsers)) return [];
	return fromUsers
		.map(function (u: any) {
			return u && u.user && u.user.id ? String(u.user.id) : str(u, "");
		})
		.filter(Boolean);
}

function targetTweetId(notifObj: any): string {
	const targets = notificationTemplate(notifObj).targetObjects;
	if (Array.isArray(targets)) {
		for (let i = 0; i < targets.length; i++) {
			const t = targets[i];
			if (t && t.tweet && t.tweet.id) return String(t.tweet.id);
		}
	}
	// Some templates expose the id directly.
	return str(notifObj && notifObj.tweetId, "");
}

export function parseNotifications(response: any): NotificationsPage {
	const globals = (response && response.globalObjects) || {};
	const usersById = globals.users || {};
	const tweetsById = globals.tweets || {};
	const timeline = (response && response.timeline) || {};
	const instructions = timeline.instructions || [];

	const items: XNotification[] = [];
	let cursor: string | undefined;

	// The tweet objects in globalObjects are legacy-only and reference their
	// quoted/retweeted originals by id (quoted_status_id_str / retweeted_status_id_str)
	// rather than inlining them like GraphQL does. Wrap each into the GraphQL-ish
	// shape the shared parser expects — including nested quote/retweet results — so
	// parseTweetResult resolves media, counts, quotes and retweets uniformly. `seen`
	// guards against a malformed self/cyclic reference recursing forever.
	function wrapTweet(id: string, seen: Record<string, boolean>): any {
		const raw = tweetsById[id];
		if (!raw || seen[id]) return null;
		seen[id] = true;
		const authorId = str(raw.user_id_str, "");
		const legacy: any = {
			...raw,
			is_quote_status: Boolean(raw.is_quote_status || raw.quoted_status_id_str)
		};
		const quotedId = str(raw.quoted_status_id_str, "");
		if (quotedId) {
			const quoted = wrapTweet(quotedId, seen);
			if (quoted) legacy.quoted_status_result = { result: quoted };
		}
		const retweetedId = str(raw.retweeted_status_id_str, "");
		if (retweetedId) {
			const retweeted = wrapTweet(retweetedId, seen);
			if (retweeted) legacy.retweeted_status_result = { result: retweeted };
		}
		return {
			rest_id: id,
			legacy: legacy,
			core: { user_results: { result: { rest_id: authorId, legacy: usersById[authorId] || {} } } },
			views: raw.ext_views ? { count: str(raw.ext_views.count, "0") } : undefined
		};
	}

	function tweetById(id: string): Tweet | undefined {
		const wrapped = wrapTweet(id, {});
		if (!wrapped) return undefined;
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
				const tweetId = targetTweetId(notifObj);
				const tweet = tweetId ? tweetById(tweetId) : undefined;
				let users = actorIds(notifObj).map(function (uid: string) {
					return userFromGlobal(usersById[uid], uid);
				});
				// "Recent post from X" notifications often omit fromUsers — the actor IS
				// the poster, so fall back to the tweet author for the avatar/name.
				if (users.length === 0 && tweet) users = [tweet.author];
				items.push({
					id: str(notifId, String(j)),
					kind: kindFromEntry(notifObj),
					createdAt: num(parseInt(notifObj.timestampMs, 10), 0),
					text: messageText(notifObj),
					users: users,
					tweet: tweet
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
