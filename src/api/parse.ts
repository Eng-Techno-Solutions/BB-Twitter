import type { TimelinePage, Tweet, XMedia, XMediaType, XUser } from "../types/x";

// X's internal GraphQL responses are deeply nested and inconsistent (tweets come
// wrapped as "Tweet", "TweetWithVisibilityResults", or tombstoned). This module
// is the ONLY place that knows those shapes — every screen consumes normalized
// `Tweet`/`XUser` values. Access is defensive: X omits fields freely and a
// missing branch must degrade, never throw.

/* eslint-disable @typescript-eslint/no-explicit-any */

function num(value: any, fallback: number): number {
	return typeof value === "number" ? value : fallback;
}

function str(value: any, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

// X user profile image URLs default to "_normal" (48px). Bump to "_400x400" for
// a crisp avatar without fetching the full-size original.
function upscaleAvatar(url: string): string {
	return url ? url.replace("_normal", "_400x400") : url;
}

export function parseUser(userResult: any): XUser {
	const result = userResult && userResult.result ? userResult.result : userResult;
	const legacy = (result && result.legacy) || {};
	return {
		id: str(result && result.rest_id, ""),
		handle: str(legacy.screen_name, ""),
		name: str(legacy.name, ""),
		avatarUrl: upscaleAvatar(str(legacy.profile_image_url_https, "")),
		verified: Boolean(result && result.is_blue_verified) || Boolean(legacy.verified),
		bio: str(legacy.description, ""),
		followersCount: num(legacy.followers_count, 0),
		followingCount: num(legacy.friends_count, 0),
		tweetsCount: num(legacy.statuses_count, 0),
		bannerUrl: str(legacy.profile_banner_url, ""),
		following: Boolean(legacy.following),
		protected: Boolean(legacy.protected)
	};
}

// Pick the highest-bitrate mp4 variant for a video/gif.
function bestVideoVariant(variants: any[]): string {
	if (!Array.isArray(variants)) return "";
	let best = "";
	let bestBitrate = -1;
	for (let i = 0; i < variants.length; i++) {
		const v = variants[i];
		if (v && v.content_type === "video/mp4" && num(v.bitrate, 0) >= bestBitrate) {
			bestBitrate = num(v.bitrate, 0);
			best = str(v.url, "");
		}
	}
	return best;
}

function parseMedia(legacy: any): XMedia[] {
	const source =
		(legacy && legacy.extended_entities && legacy.extended_entities.media) ||
		(legacy && legacy.entities && legacy.entities.media) ||
		[];
	const out: XMedia[] = [];
	for (let i = 0; i < source.length; i++) {
		const m = source[i];
		const type = str(m.type, "photo") as XMediaType;
		const info = m.original_info || {};
		const media: XMedia = {
			type: type,
			url: str(m.media_url_https, ""),
			width: num(info.width, 0),
			height: num(info.height, 0),
			altText: str(m.ext_alt_text, "")
		};
		if (type === "video" || type === "animated_gif") {
			media.videoUrl = bestVideoVariant(m.video_info && m.video_info.variants);
		}
		out.push(media);
	}
	return out;
}

// Longform "note tweets" carry their real text outside legacy.full_text.
function tweetText(tweet: any, legacy: any): string {
	const note = tweet && tweet.note_tweet && tweet.note_tweet.note_tweet_results;
	if (note && note.result && typeof note.result.text === "string") {
		return note.result.text;
	}
	return str(legacy.full_text, "");
}

// Unwrap the two wrapper shapes X uses for a tweet node.
function unwrapTweet(result: any): any {
	if (!result) return null;
	if (result.__typename === "TweetWithVisibilityResults") return result.tweet;
	if (result.tweet && !result.legacy) return result.tweet;
	return result;
}

export function parseTweetResult(rawResult: any): Tweet | null {
	const tweet = unwrapTweet(rawResult);
	if (!tweet || !tweet.legacy) return null; // tombstone / deleted / suspended
	const legacy = tweet.legacy;
	const author = parseUser(tweet.core && tweet.core.user_results);

	const base: Tweet = {
		id: str(tweet.rest_id, str(legacy.id_str, "")),
		author: author,
		createdAt: legacy.created_at ? new Date(legacy.created_at).getTime() : 0,
		text: tweetText(tweet, legacy),
		media: parseMedia(legacy),
		replyCount: num(legacy.reply_count, 0),
		retweetCount: num(legacy.retweet_count, 0),
		likeCount: num(legacy.favorite_count, 0),
		quoteCount: num(legacy.quote_count, 0),
		viewCount: tweet.views ? num(parseInt(tweet.views.count, 10), 0) : undefined,
		liked: Boolean(legacy.favorited),
		retweeted: Boolean(legacy.retweeted),
		bookmarked: Boolean(legacy.bookmarked),
		inReplyToHandle: str(legacy.in_reply_to_screen_name, ""),
		conversationId: str(legacy.conversation_id_str, "")
	};

	// Retweet: the surfaced tweet wraps the original; show the original with a
	// "retweetedBy" attribution row.
	if (legacy.retweeted_status_result) {
		const original = parseTweetResult(legacy.retweeted_status_result.result);
		if (original) {
			original.retweetedBy = author;
			return original;
		}
	}

	// Quote: nest the quoted tweet.
	if (legacy.is_quote_status && legacy.quoted_status_result) {
		const quoted = parseTweetResult(legacy.quoted_status_result.result);
		if (quoted) base.quoted = quoted;
	}

	return base;
}

// ---- Timeline traversal ---------------------------------------------------
// Home/User/Search/Bookmarks all share the "instructions → entries" shape but
// root the instructions at different paths. Callers pass the already-resolved
// instructions array; these helpers turn it into a TimelinePage.

function entryTweet(entry: any): Tweet | null {
	const content = entry && entry.content;
	if (!content) return null;
	if (
		content.entryType === "TimelineTimelineItem" ||
		content.__typename === "TimelineTimelineItem"
	) {
		const item = content.itemContent;
		if (item && item.itemContent) return null; // module sub-item, handled below
		if (item && item.tweet_results) return parseTweetResult(item.tweet_results.result);
	}
	return null;
}

export function parseTimeline(instructions: any[]): TimelinePage {
	const tweets: Tweet[] = [];
	let topCursor: string | undefined;
	let bottomCursor: string | undefined;
	const list = Array.isArray(instructions) ? instructions : [];

	for (let i = 0; i < list.length; i++) {
		const instruction = list[i];
		const entries = instruction && instruction.entries;
		if (!Array.isArray(entries)) continue;

		for (let j = 0; j < entries.length; j++) {
			const entry = entries[j];
			const content = entry && entry.content;
			if (!content) continue;

			const entryType = content.entryType || content.__typename;

			if (entryType === "TimelineTimelineCursor") {
				if (content.cursorType === "Top") topCursor = str(content.value, undefined);
				if (content.cursorType === "Bottom") bottomCursor = str(content.value, undefined);
				continue;
			}

			// Conversation modules (replies) hold several tweets under content.items.
			if (entryType === "TimelineTimelineModule" && Array.isArray(content.items)) {
				for (let k = 0; k < content.items.length; k++) {
					const sub = content.items[k].item;
					const ic = sub && sub.itemContent;
					if (ic && ic.tweet_results) {
						const t = parseTweetResult(ic.tweet_results.result);
						if (t) tweets.push(t);
					}
				}
				continue;
			}

			const single = entryTweet(entry);
			if (single) tweets.push(single);
		}
	}

	return { tweets: tweets, topCursor: topCursor, bottomCursor: bottomCursor };
}

// Resolve the instructions array from the various operation response roots so
// callers don't each re-encode X's path quirks.
export function instructionsFromResponse(response: any): any[] {
	const data = response && response.data;
	if (!data) return [];
	// HomeTimeline / HomeLatestTimeline
	if (data.home && data.home.home_timeline_urt)
		return data.home.home_timeline_urt.instructions || [];
	// TweetDetail
	if (data.threaded_conversation_with_injections_v2) {
		return data.threaded_conversation_with_injections_v2.instructions || [];
	}
	// UserTweets / UserTweetsAndReplies / UserMedia / Likes
	const userTimeline =
		data.user &&
		data.user.result &&
		(data.user.result.timeline_v2 || data.user.result.timeline) &&
		(data.user.result.timeline_v2 || data.user.result.timeline).timeline;
	if (userTimeline) return userTimeline.instructions || [];
	// SearchTimeline
	if (data.search_by_raw_query && data.search_by_raw_query.search_timeline) {
		return data.search_by_raw_query.search_timeline.timeline.instructions || [];
	}
	// Bookmarks
	if (data.bookmark_timeline_v2) return data.bookmark_timeline_v2.timeline.instructions || [];
	return [];
}
