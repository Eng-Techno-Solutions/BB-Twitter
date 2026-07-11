import { API, type XGqlOp, X_GQL, X_WEB_BEARER } from "../utils/constants";
import { request } from "./http";
import { Platform } from "react-native";

const IS_WEB = Platform.OS === "web";
const GQL_BASE = IS_WEB ? API.GQL_PROXY : API.GQL_WEB;
const V11_BASE = IS_WEB ? API.V11_PROXY : API.V11_WEB;
const V2_BASE = IS_WEB ? API.V2_PROXY : API.V2_WEB;

// X's GraphQL endpoints reject requests that omit feature flags it expects. This
// is the current default set the web client sends. When X adds a new required
// flag it surfaces as a 400 "missing features" error — add the named flag here.
const DEFAULT_FEATURES = {
	rweb_tipjar_consumption_enabled: true,
	responsive_web_graphql_exclude_directive_enabled: true,
	verified_phone_label_enabled: false,
	creator_subscriptions_tweet_preview_api_enabled: true,
	responsive_web_graphql_timeline_navigation_enabled: true,
	responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
	communities_web_enable_tweet_community_results_fetch: true,
	c9s_tweet_anatomy_moderator_badge_enabled: true,
	tweetypie_unmention_optimization_enabled: true,
	responsive_web_edit_tweet_api_enabled: true,
	graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
	view_counts_everywhere_api_enabled: true,
	longform_notetweets_consumption_enabled: true,
	responsive_web_twitter_article_tweet_consumption_enabled: true,
	tweet_awards_web_tipping_enabled: false,
	freedom_of_speech_not_reach_fetch_enabled: true,
	standardized_nudges_misinfo: true,
	tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
	longform_notetweets_rich_text_read_enabled: true,
	longform_notetweets_inline_media_enabled: true,
	responsive_web_enhance_cards_enabled: false
};

// Minimal feature set the Viewer identity query accepts (verified against the
// live endpoint — the full DEFAULT_FEATURES set is rejected for this op).
const VIEWER_FEATURES = {
	responsive_web_graphql_exclude_directive_enabled: true,
	responsive_web_graphql_timeline_navigation_enabled: true,
	responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
	rweb_tipjar_consumption_enabled: true,
	verified_phone_label_enabled: false,
	creator_subscriptions_tweet_preview_api_enabled: true
};

export interface XCredentials {
	authToken: string;
	csrf: string;
}

// Thin client over X's internal API. Mirrors BBSlack's SlackAPI: one class, an
// auth-header builder, low-level get/post helpers, and one method per operation.
// It returns RAW json (parse layer flattens it) — the same contract SlackAPI has
// with its callers. It throws on transport/HTTP failure; semantic emptiness is
// left to the parse layer.
export default class XAPI {
	authToken: string;
	csrf: string;

	constructor(creds: XCredentials) {
		this.authToken = creds.authToken;
		this.csrf = creds.csrf;
	}

	_headers(): Record<string, string> {
		const cookie = "auth_token=" + this.authToken + "; ct0=" + this.csrf;
		const headers: Record<string, string> = {
			Authorization: X_WEB_BEARER,
			"Content-Type": "application/json",
			"x-csrf-token": this.csrf,
			"x-twitter-auth-type": "OAuth2Session",
			"x-twitter-active-user": "yes",
			"x-twitter-client-language": "en"
		};
		// Browsers forbid JS from setting the Cookie header on fetch, so on web we
		// relay it in a custom header that the dev proxy rewrites to a real Cookie
		// (setupProxy.js). Native HttpModule has no such restriction.
		if (IS_WEB) {
			headers["x-bbt-cookie"] = cookie;
		} else {
			headers["Cookie"] = cookie;
		}
		return headers;
	}

	_op(op: XGqlOp): { queryId: string; name: string } {
		const entry = X_GQL[op];
		return { queryId: entry[0], name: entry[1] };
	}

	// GraphQL read. variables + features are JSON-encoded query params. Some
	// operations (e.g. Viewer) reject the full DEFAULT_FEATURES set with an
	// "unknown feature" error, so callers can pass an operation-specific set.
	async _gqlGet(
		op: XGqlOp,
		variables: Record<string, unknown>,
		features?: Record<string, boolean>
	): Promise<unknown> {
		const { queryId, name } = this._op(op);
		const url =
			GQL_BASE +
			queryId +
			"/" +
			name +
			"?variables=" +
			encodeURIComponent(JSON.stringify(variables)) +
			"&features=" +
			encodeURIComponent(JSON.stringify(features || DEFAULT_FEATURES));
		const res = await request("GET", url, this._headers(), "");
		return this._parseBody(res.body, res.status);
	}

	// GraphQL mutation. queryId travels in the body, not the path.
	async _gqlPost(op: XGqlOp, variables: Record<string, unknown>): Promise<unknown> {
		const { queryId, name } = this._op(op);
		const url = GQL_BASE + queryId + "/" + name;
		const body = JSON.stringify({
			variables: variables,
			features: DEFAULT_FEATURES,
			queryId: queryId
		});
		const res = await request("POST", url, this._headers(), body);
		return this._parseBody(res.body, res.status);
	}

	async _v11Get(path: string, params: Record<string, string | number | boolean>): Promise<unknown> {
		const qs = Object.keys(params || {})
			.map(function (k) {
				return encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k]));
			})
			.join("&");
		const url = V11_BASE + path + (qs ? "?" + qs : "");
		const res = await request("GET", url, this._headers(), "");
		return this._parseBody(res.body, res.status);
	}

	async _v11Post(path: string, body: Record<string, unknown>): Promise<unknown> {
		const url = V11_BASE + path;
		const res = await request("POST", url, this._headers(), JSON.stringify(body));
		return this._parseBody(res.body, res.status);
	}

	async _v2Get(path: string, params: Record<string, string | number | boolean>): Promise<unknown> {
		const qs = Object.keys(params || {})
			.map(function (k) {
				return encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k]));
			})
			.join("&");
		const url = V2_BASE + path + (qs ? "?" + qs : "");
		const res = await request("GET", url, this._headers(), "");
		return this._parseBody(res.body, res.status);
	}

	_parseBody(body: string, status: number): unknown {
		let data: unknown;
		try {
			data = JSON.parse(body);
		} catch (_e) {
			throw new Error("Bad response from X (HTTP " + status + ")");
		}
		if (status === 401 || status === 403) {
			throw new Error("Session expired. Please sign in again.");
		}
		if (status === 429) {
			throw new Error("Rate limited by X. Please wait a moment.");
		}
		if (status >= 400) {
			const errs = (data as { errors?: Array<{ message?: string }> }).errors;
			const msg = errs && errs[0] && errs[0].message ? errs[0].message : "HTTP " + status;
			throw new Error(msg);
		}
		return data;
	}

	// ---- Auth / identity ----------------------------------------------------
	// Validates the session and returns the logged-in identity. Uses GraphQL
	// Viewer — the same call x.com's web client makes — because the legacy REST
	// verify_credentials endpoint is unreachable under cookie (OAuth2Session) auth
	// (returns 404 code 34). The identity is at data.viewer.user_results.
	viewer(): Promise<unknown> {
		return this._gqlGet("Viewer", { withCommunitiesMemberships: true }, VIEWER_FEATURES);
	}

	// ---- Timelines ----------------------------------------------------------
	homeTimeline(cursor?: string, count?: number): Promise<unknown> {
		return this._gqlPost("HomeTimeline", {
			count: count || 20,
			cursor: cursor,
			includePromotedContent: false,
			latestControlAvailable: true,
			seenTweetIds: []
		});
	}

	homeLatestTimeline(cursor?: string, count?: number): Promise<unknown> {
		return this._gqlPost("HomeLatestTimeline", {
			count: count || 20,
			cursor: cursor,
			includePromotedContent: false,
			latestControlAvailable: true
		});
	}

	tweetDetail(tweetId: string, cursor?: string): Promise<unknown> {
		return this._gqlGet("TweetDetail", {
			focalTweetId: tweetId,
			cursor: cursor,
			referrer: "tweet",
			with_rux_injections: false,
			includePromotedContent: false,
			withCommunity: true,
			withQuickPromoteEligibilityTweetFields: false,
			withBirdwatchNotes: true,
			withVoice: true,
			withV2Timeline: true
		});
	}

	searchTimeline(query: string, product: string, cursor?: string): Promise<unknown> {
		return this._gqlGet("SearchTimeline", {
			rawQuery: query,
			count: 20,
			cursor: cursor,
			querySource: "typed_query",
			product: product || "Top" // Top | Latest | People | Media
		});
	}

	bookmarks(cursor?: string): Promise<unknown> {
		return this._gqlGet("Bookmarks", { count: 20, cursor: cursor });
	}

	// ---- Users --------------------------------------------------------------
	userByScreenName(handle: string): Promise<unknown> {
		return this._gqlGet("UserByScreenName", {
			screen_name: handle,
			withSafetyModeUserFields: true
		});
	}

	userTweets(userId: string, cursor?: string): Promise<unknown> {
		return this._gqlGet("UserTweets", {
			userId: userId,
			count: 20,
			cursor: cursor,
			includePromotedContent: false,
			withQuickPromoteEligibilityTweetFields: false,
			withVoice: true,
			withV2Timeline: true
		});
	}

	userTweetsAndReplies(userId: string, cursor?: string): Promise<unknown> {
		return this._gqlGet("UserTweetsAndReplies", {
			userId: userId,
			count: 20,
			cursor: cursor,
			includePromotedContent: false,
			withCommunity: true,
			withVoice: true,
			withV2Timeline: true
		});
	}

	userMedia(userId: string, cursor?: string): Promise<unknown> {
		return this._gqlGet("UserMedia", {
			userId: userId,
			count: 20,
			cursor: cursor,
			includePromotedContent: false,
			withVoice: true,
			withV2Timeline: true
		});
	}

	userLikes(userId: string, cursor?: string): Promise<unknown> {
		return this._gqlGet("Likes", {
			userId: userId,
			count: 20,
			cursor: cursor,
			includePromotedContent: false,
			withVoice: true,
			withV2Timeline: true
		});
	}

	// ---- Engagement (mutations) --------------------------------------------
	createTweet(
		text: string,
		replyToId?: string,
		quoteTweetId?: string,
		mediaIds?: string[]
	): Promise<unknown> {
		const variables: Record<string, unknown> = {
			tweet_text: text,
			dark_request: false,
			media: {
				media_entities: (mediaIds || []).map(function (id) {
					return { media_id: id, tagged_users: [] as string[] };
				}),
				possibly_sensitive: false
			},
			semantic_annotation_ids: []
		};
		if (replyToId) {
			variables.reply = { in_reply_to_tweet_id: replyToId, exclude_reply_user_ids: [] };
		}
		if (quoteTweetId) {
			variables.attachment_url = "https://x.com/i/status/" + quoteTweetId;
		}
		return this._gqlPost("CreateTweet", variables);
	}

	deleteTweet(tweetId: string): Promise<unknown> {
		return this._gqlPost("DeleteTweet", { tweet_id: tweetId, dark_request: false });
	}

	favoriteTweet(tweetId: string): Promise<unknown> {
		return this._gqlPost("FavoriteTweet", { tweet_id: tweetId });
	}

	unfavoriteTweet(tweetId: string): Promise<unknown> {
		return this._gqlPost("UnfavoriteTweet", { tweet_id: tweetId });
	}

	createRetweet(tweetId: string): Promise<unknown> {
		return this._gqlPost("CreateRetweet", { tweet_id: tweetId, dark_request: false });
	}

	deleteRetweet(tweetId: string): Promise<unknown> {
		return this._gqlPost("DeleteRetweet", { source_tweet_id: tweetId, dark_request: false });
	}

	createBookmark(tweetId: string): Promise<unknown> {
		return this._gqlPost("CreateBookmark", { tweet_id: tweetId });
	}

	deleteBookmark(tweetId: string): Promise<unknown> {
		return this._gqlPost("DeleteBookmark", { tweet_id: tweetId });
	}

	// ---- Follow (v1.1 form endpoints) --------------------------------------
	follow(userId: string): Promise<unknown> {
		return this._v11Post("friendships/create.json?user_id=" + encodeURIComponent(userId), {});
	}

	unfollow(userId: string): Promise<unknown> {
		return this._v11Post("friendships/destroy.json?user_id=" + encodeURIComponent(userId), {});
	}

	// ---- Notifications ------------------------------------------------------
	notifications(cursor?: string): Promise<unknown> {
		const params: Record<string, string | number | boolean> = { count: 40 };
		if (cursor) params.cursor = cursor;
		return this._v2Get("notifications/all.json", params);
	}

	// Lightweight unread counts for the tab badge (notifications + DMs).
	badgeCount(): Promise<unknown> {
		return this._v2Get("badge_count/badge_count.json", { supports_ntab_urt: 1 });
	}

	// ---- Direct messages ----------------------------------------------------
	dmInbox(): Promise<unknown> {
		return this._v11Get("dm/inbox_initial_state.json", {
			include_conversation_info: true,
			dm_users: false
		});
	}

	// Message requests / low-quality inbox. X keeps these OUT of the initial state
	// (which only returns the "trusted" inbox), so we fetch them separately and
	// merge, otherwise those conversations are invisible in the app. (dm_users is
	// not a valid param on this endpoint — it 400s; the timeline endpoints take
	// filter_low_quality instead.) Best-effort: loadInbox tolerates failure.
	dmInboxUntrusted(): Promise<unknown> {
		return this._v11Get("dm/inbox_timeline/untrusted.json", {
			filter_low_quality: false,
			include_conversation_info: true
		});
	}

	dmConversation(conversationId: string): Promise<unknown> {
		return this._v11Get("dm/conversation/" + conversationId + ".json", {});
	}

	dmSend(conversationId: string, text: string): Promise<unknown> {
		return this._v11Post("dm/new2.json", {
			conversation_id: conversationId,
			recipient_ids: false,
			text: text,
			cards_platform: "Web-12",
			include_cards: 1
		});
	}

	// ---- Explore / trends ---------------------------------------------------
	trends(): Promise<unknown> {
		return this._v2Get("guide.json", { count: 20, candidate_source: "trends" });
	}

	// ---- Media --------------------------------------------------------------
	// Single-shot media upload (fine for images/GIFs up to ~5MB). Uses the generic
	// request() path — NOT the native uploadMultipart helper — because that helper
	// only sends a Bearer header, whereas X's upload host also requires the
	// OAuth2Session cookie + csrf that _headers() supplies. Returns the media_id
	// to hand to createTweet. Android-only in practice (needs base64 + cookie auth).
	async uploadMediaSimple(base64: string, mimeType: string): Promise<string> {
		const url = IS_WEB ? API.MEDIA_UPLOAD_PROXY : API.MEDIA_UPLOAD_WEB;
		const headers = this._headers();
		headers["Content-Type"] = "application/x-www-form-urlencoded";
		const category =
			mimeType.indexOf("gif") !== -1
				? "tweet_gif"
				: mimeType.indexOf("video") !== -1
					? "tweet_video"
					: "tweet_image";
		const body = "media_data=" + encodeURIComponent(base64) + "&media_category=" + category;
		const res = await request("POST", url, headers, body);
		const data = this._parseBody(res.body, res.status) as { media_id_string?: string };
		if (!data.media_id_string) throw new Error("Media upload failed");
		return data.media_id_string;
	}
}
