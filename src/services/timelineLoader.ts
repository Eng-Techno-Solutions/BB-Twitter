import { instructionsFromResponse, parseTimeline, parseTweetResult } from "../api/parse";
import type XAPI from "../api/xapi";
import type { TimelinePage, Tweet } from "../types/x";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Orchestration between the raw XAPI client and the parse layer — the data-access
// seam for every tweet list. Screens call these, never XAPI/parse directly, so the
// GraphQL-shape knowledge stays out of the UI (Separation of Concerns).

export type HomeTab = "forYou" | "following";

export async function loadHome(api: XAPI, tab: HomeTab, cursor?: string): Promise<TimelinePage> {
	const response =
		tab === "following" ? await api.homeLatestTimeline(cursor) : await api.homeTimeline(cursor);
	return parseTimeline(instructionsFromResponse(response));
}

export async function loadUserTweets(
	api: XAPI,
	userId: string,
	cursor?: string
): Promise<TimelinePage> {
	const response = await api.userTweets(userId, cursor);
	return parseTimeline(instructionsFromResponse(response));
}

export async function loadUserReplies(
	api: XAPI,
	userId: string,
	cursor?: string
): Promise<TimelinePage> {
	const response = await api.userTweetsAndReplies(userId, cursor);
	return parseTimeline(instructionsFromResponse(response));
}

export async function loadUserMedia(
	api: XAPI,
	userId: string,
	cursor?: string
): Promise<TimelinePage> {
	const response = await api.userMedia(userId, cursor);
	return parseTimeline(instructionsFromResponse(response));
}

export async function loadUserLikes(
	api: XAPI,
	userId: string,
	cursor?: string
): Promise<TimelinePage> {
	const response = await api.userLikes(userId, cursor);
	return parseTimeline(instructionsFromResponse(response));
}

export async function loadBookmarks(api: XAPI, cursor?: string): Promise<TimelinePage> {
	const response = await api.bookmarks(cursor);
	return parseTimeline(instructionsFromResponse(response));
}

export type SearchProduct = "Top" | "Latest" | "Media";

export async function loadSearch(
	api: XAPI,
	query: string,
	product: SearchProduct,
	cursor?: string
): Promise<TimelinePage> {
	const response = await api.searchTimeline(query, product, cursor);
	return parseTimeline(instructionsFromResponse(response));
}

export interface ConversationResult {
	focalTweet: Tweet | null;
	replies: Tweet[];
	bottomCursor?: string;
}

// TweetDetail returns the focal tweet plus its replies in one instruction stream.
// We split the focal tweet out so the screen can render it as the header.
export async function loadConversation(
	api: XAPI,
	tweetId: string,
	cursor?: string
): Promise<ConversationResult> {
	const response: any = await api.tweetDetail(tweetId, cursor);
	const page = parseTimeline(instructionsFromResponse(response));
	let focalTweet: Tweet | null = null;
	const replies: Tweet[] = [];
	for (let i = 0; i < page.tweets.length; i++) {
		const t = page.tweets[i];
		if (t.id === tweetId) {
			focalTweet = t;
		} else {
			replies.push(t);
		}
	}
	return { focalTweet: focalTweet, replies: replies, bottomCursor: page.bottomCursor };
}

// After a like/repost mutation X echoes the updated tweet; parse it so the caller
// can swap fresh counts into its list without a full reload.
export function tweetFromMutation(response: any, opName: string): Tweet | null {
	const root =
		response &&
		response.data &&
		(response.data.create_tweet ||
			response.data.tweet ||
			(response.data as Record<string, any>)[opName]);
	const result = root && (root.tweet_results ? root.tweet_results.result : root.result);
	return result ? parseTweetResult(result) : null;
}
