import type XAPI from "../api/xapi";
import type { Tweet } from "../types/x";

// Engagement = the tweet analog of BBSlack's reactionService. Two concerns kept
// separate: PURE optimistic-update helpers (apply*) the UI calls synchronously to
// flip state instantly, and the network calls (commit*) that persist it. The
// screen applies the optimistic change, fires the commit, and reverts on throw —
// so a slow or rate-limited X never blocks the tap.

export function applyLike(tweet: Tweet): Tweet {
	const liked = !tweet.liked;
	return Object.assign({}, tweet, {
		liked: liked,
		likeCount: Math.max(0, tweet.likeCount + (liked ? 1 : -1))
	});
}

export function applyRetweet(tweet: Tweet): Tweet {
	const retweeted = !tweet.retweeted;
	return Object.assign({}, tweet, {
		retweeted: retweeted,
		retweetCount: Math.max(0, tweet.retweetCount + (retweeted ? 1 : -1))
	});
}

export function applyBookmark(tweet: Tweet): Tweet {
	return Object.assign({}, tweet, { bookmarked: !tweet.bookmarked });
}

// `wasActive` is the state BEFORE the optimistic flip — it decides add vs remove
// so the commit matches what the UI already showed.
export function commitLike(api: XAPI, tweetId: string, wasLiked: boolean): Promise<unknown> {
	return wasLiked ? api.unfavoriteTweet(tweetId) : api.favoriteTweet(tweetId);
}

export function commitRetweet(api: XAPI, tweetId: string, wasRetweeted: boolean): Promise<unknown> {
	return wasRetweeted ? api.deleteRetweet(tweetId) : api.createRetweet(tweetId);
}

export function commitBookmark(
	api: XAPI,
	tweetId: string,
	wasBookmarked: boolean
): Promise<unknown> {
	return wasBookmarked ? api.deleteBookmark(tweetId) : api.createBookmark(tweetId);
}
