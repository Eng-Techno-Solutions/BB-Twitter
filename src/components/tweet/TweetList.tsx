import type XAPI from "../../api/xapi";
import {
	applyBookmark,
	applyLike,
	applyRetweet,
	commitBookmark,
	commitLike,
	commitRetweet
} from "../../services/engagementService";
import { getView, patchView, saveView, setScrollOffset } from "../../services/viewCache";
import { getColors, getMessageFontSize } from "../../theme";
import type { KeyEvent, KeySub } from "../../types/events";
import type { TimelinePage, Tweet, XUser } from "../../types/x";
import { errorMessage } from "../../utils/error";
import { addKeyEventListener, removeKeyEventListener } from "../../utils/keyEvents";
import { scrollListByKey } from "../../utils/listScroll";
import { logger } from "../../utils/logger";
import { handleScrollTopSignal } from "../../utils/scrollToTop";
import { ErrorView } from "../ui";
import RepostMenu from "./RepostMenu";
import TweetItem from "./TweetItem";
import React, { Component } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import type { ListRenderItemInfo } from "react-native";

export interface TweetListProps {
	api: XAPI;
	loadPage: (cursor?: string) => Promise<TimelinePage>;
	// When set, this feed's tweets/cursor/scroll survive unmount via viewCache, so
	// returning to it restores instantly instead of refetching. Omit for ephemeral
	// feeds (search results, a tweet thread) that shouldn't persist.
	cacheKey?: string;
	onOpenTweet: (tweet: Tweet) => void;
	onOpenAuthor: (user: XUser) => void;
	onReply: (tweet: Tweet) => void;
	onQuote: (tweet: Tweet) => void;
	ListHeaderComponent?: React.ReactElement | null;
	emptyText?: string;
	// Bumped by App when the active tab is re-tapped; a change scrolls to top.
	scrollTopSignal?: number;
	// Opt-in: translate Q20 trackpad up/down key events into list scrolling.
	scrollWithKeys?: boolean;
}

interface TweetListState {
	tweets: Tweet[];
	cursor?: string;
	loading: boolean;
	refreshing: boolean;
	loadingMore: boolean;
	error: string | null;
	nowMs: number;
	// The tweet whose repost menu is open (Repost/Quote chooser); null = closed.
	menuTweet: Tweet | null;
}

// The reusable feed. Home / Profile tabs / Bookmarks / Search results all render
// an engageable tweet list that differs only in WHICH page-loader they pass — so
// the FlatList, pull-to-refresh, infinite scroll, optimistic engagement, and Q20
// list-perf tuning live here once (DRY), and screens stay thin.
export default class TweetList extends Component<TweetListProps, TweetListState> {
	_mounted: boolean;
	// FlatList ref + the offset to restore on a cache hit.
	_listRef: FlatList<Tweet> | null;
	_restoreOffset: number;
	// Current scroll offset, tracked so trackpad key events scroll from it.
	_scrollY: number;
	// Q20 trackpad key-event subscription (only when scrollWithKeys is set).
	_keySub: KeySub | null;

	constructor(props: TweetListProps) {
		super(props);
		// On mount, read the cached feed (if this list is cacheable and warm) so we
		// render its tweets synchronously — no spinner, no refetch, position kept.
		const cached = props.cacheKey ? getView<Tweet>(props.cacheKey) : null;
		this.state = {
			tweets: cached ? cached.data : [],
			cursor: cached ? cached.cursor : undefined,
			loading: cached ? false : true,
			refreshing: false,
			loadingMore: false,
			error: null,
			nowMs: Date.now(),
			menuTweet: null
		};
		this._mounted = false;
		this._listRef = null;
		this._restoreOffset = cached ? cached.scrollOffset : 0;
		this._scrollY = this._restoreOffset;
		this._keySub = null;
		this._renderItem = this._renderItem.bind(this);
		this._keyExtractor = this._keyExtractor.bind(this);
		this._onEndReached = this._onEndReached.bind(this);
		this._refresh = this._refresh.bind(this);
	}

	componentDidMount(): void {
		this._mounted = true;
		// Cache hit: data is already in state — just restore scroll. Otherwise cold
		// load from the network as before.
		if (this.state.tweets.length > 0) {
			this._restoreScroll();
		} else {
			this._initialLoad();
		}
		if (this.props.scrollWithKeys) {
			const self = this;
			this._keySub = addKeyEventListener(function (e: KeyEvent) {
				self._scrollY = scrollListByKey(self._listRef, self._scrollY, e.action);
			});
		}
	}

	componentDidUpdate(prev: TweetListProps): void {
		handleScrollTopSignal(
			prev.scrollTopSignal,
			this.props.scrollTopSignal,
			this._listRef,
			this.props.cacheKey
		);
	}

	componentWillUnmount(): void {
		this._mounted = false;
		removeKeyEventListener(this._keySub);
	}

	_save(tweets: Tweet[], cursor?: string): void {
		if (this.props.cacheKey) saveView(this.props.cacheKey, tweets, cursor);
	}

	// Best-effort scroll restore (mirrors safeScrollToIndex's philosophy): the
	// virtualized list may not have measured far-down rows yet, so retry once.
	_restoreScroll(): void {
		const offset = this._restoreOffset;
		if (!offset) return;
		const self = this;
		const apply = function () {
			if (self._mounted && self._listRef) {
				self._listRef.scrollToOffset({ offset: offset, animated: false });
			}
		};
		setTimeout(apply, 0);
		setTimeout(apply, 200);
	}

	_onScroll = (e: { nativeEvent: { contentOffset: { y: number } } }): void => {
		this._scrollY = e.nativeEvent.contentOffset.y;
		if (this.props.cacheKey) setScrollOffset(this.props.cacheKey, this._scrollY);
	};

	async _initialLoad(): Promise<void> {
		try {
			const page = await this.props.loadPage();
			if (!this._mounted) return;
			this._save(page.tweets, page.bottomCursor);
			this.setState({
				tweets: page.tweets,
				cursor: page.bottomCursor,
				loading: false,
				error: null,
				nowMs: Date.now()
			});
		} catch (err: unknown) {
			if (!this._mounted) return;
			this.setState({ loading: false, error: errorMessage(err, "Couldn't load posts") });
		}
	}

	async _refresh(): Promise<void> {
		this.setState({ refreshing: true });
		try {
			const page = await this.props.loadPage();
			if (!this._mounted) return;
			this._save(page.tweets, page.bottomCursor);
			this.setState({
				tweets: page.tweets,
				cursor: page.bottomCursor,
				refreshing: false,
				error: null,
				nowMs: Date.now()
			});
		} catch (err: unknown) {
			if (!this._mounted) return;
			this.setState({ refreshing: false });
			logger.warn("TweetList.refresh", "refresh failed", err);
		}
	}

	async _onEndReached(): Promise<void> {
		if (this.state.loadingMore || !this.state.cursor) return;
		this.setState({ loadingMore: true });
		try {
			const page = await this.props.loadPage(this.state.cursor);
			if (!this._mounted) return;
			const existing = this.state.tweets;
			const merged = existing.concat(dedupe(existing, page.tweets));
			this._save(merged, page.bottomCursor);
			this.setState({ tweets: merged, cursor: page.bottomCursor, loadingMore: false });
		} catch (err: unknown) {
			if (!this._mounted) return;
			this.setState({ loadingMore: false });
			logger.warn("TweetList.loadMore", "pagination failed", err);
		}
	}

	// Optimistic engagement: swap the row immediately, commit in the background,
	// revert to the pre-tap tweet if the network call fails. The tap never waits.
	_engage(tweet: Tweet, apply: (t: Tweet) => Tweet, commit: () => Promise<unknown>): void {
		const optimistic = apply(tweet);
		this._replaceTweet(optimistic);
		const self = this;
		commit().catch(function (err: unknown) {
			logger.warn("TweetList.engage", "commit failed, reverting", err);
			if (self._mounted) self._replaceTweet(tweet);
		});
	}

	_replaceTweet(updated: Tweet): void {
		const cacheKey = this.props.cacheKey;
		this.setState(function (prev: TweetListState) {
			const tweets = prev.tweets.map(function (t: Tweet) {
				return t.id === updated.id ? updated : t;
			});
			if (cacheKey) patchView(cacheKey, tweets);
			return { tweets: tweets } as TweetListState;
		});
	}

	_onLike = (tweet: Tweet): void => {
		const api = this.props.api;
		this._engage(tweet, applyLike, function () {
			return commitLike(api, tweet.id, tweet.liked);
		});
	};

	// Tapping the repost icon no longer reposts immediately — it opens the chooser
	// so the user can Repost or Quote (matching X). The actual repost still runs
	// optimistically once picked.
	_onRetweet = (tweet: Tweet): void => {
		this.setState({ menuTweet: tweet });
	};

	_closeMenu = (): void => {
		this.setState({ menuTweet: null });
	};

	_onMenuRepost = (): void => {
		const tweet = this.state.menuTweet;
		if (!tweet) return;
		const api = this.props.api;
		this._closeMenu();
		this._engage(tweet, applyRetweet, function () {
			return commitRetweet(api, tweet.id, tweet.retweeted);
		});
	};

	_onMenuQuote = (): void => {
		const tweet = this.state.menuTweet;
		if (!tweet) return;
		this._closeMenu();
		this.props.onQuote(tweet);
	};

	_onBookmark = (tweet: Tweet): void => {
		const api = this.props.api;
		this._engage(tweet, applyBookmark, function () {
			return commitBookmark(api, tweet.id, tweet.bookmarked);
		});
	};

	_keyExtractor(tweet: Tweet): string {
		return tweet.id;
	}

	_renderItem(info: ListRenderItemInfo<Tweet>): React.ReactElement {
		return (
			<TweetItem
				tweet={info.item}
				nowMs={this.state.nowMs}
				fontSize={getMessageFontSize()}
				onPress={this.props.onOpenTweet}
				onPressAuthor={this.props.onOpenAuthor}
				onReply={this.props.onReply}
				onRetweet={this._onRetweet}
				onLike={this._onLike}
				onBookmark={this._onBookmark}
			/>
		);
	}

	_renderFooter(): React.ReactElement | null {
		if (!this.state.loadingMore) return null;
		const c = getColors();
		return (
			<View style={{ paddingVertical: 20, alignItems: "center" }}>
				<ActivityIndicator
					size="small"
					color={c.accent}
				/>
			</View>
		);
	}

	render(): React.ReactNode {
		const { loading, error, tweets, refreshing } = this.state;
		const c = getColors();

		if (loading) {
			return (
				<View
					style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
					<ActivityIndicator
						size="large"
						color={c.accent}
					/>
				</View>
			);
		}

		if (error && tweets.length === 0) {
			return (
				<ErrorView
					title="Couldn't load posts"
					message={error}
					onRetry={() => {
						this.setState({ loading: true, error: null });
						this._initialLoad();
					}}
				/>
			);
		}

		const menuTweet = this.state.menuTweet;
		return (
			<View style={{ flex: 1, backgroundColor: c.bg }}>
				<FlatList
					ref={(ref) => {
						this._listRef = ref;
					}}
					onScroll={this._onScroll}
					scrollEventThrottle={100}
					style={{ flex: 1, backgroundColor: c.bg }}
					data={tweets}
					keyExtractor={this._keyExtractor}
					renderItem={this._renderItem}
					extraData={getMessageFontSize()}
					ListHeaderComponent={this.props.ListHeaderComponent}
					ListEmptyComponent={
						<View style={{ padding: 40, alignItems: "center" }}>
							<Text style={{ color: c.textTertiary, fontSize: 15 }}>
								{this.props.emptyText || "Nothing here yet."}
							</Text>
						</View>
					}
					ListFooterComponent={this._renderFooter()}
					onEndReached={this._onEndReached}
					onEndReachedThreshold={0.6}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={this._refresh}
							tintColor={c.accent}
							colors={[c.accent]}
						/>
					}
					initialNumToRender={8}
					maxToRenderPerBatch={8}
					windowSize={9}
					removeClippedSubviews={true}
				/>
				{menuTweet ? (
					<RepostMenu
						retweeted={menuTweet.retweeted}
						onRepost={this._onMenuRepost}
						onQuote={this._onMenuQuote}
						onClose={this._closeMenu}
					/>
				) : null}
			</View>
		);
	}
}

// Pagination can echo tweets already shown (promoted/pinned re-injection); drop
// dupes so keys stay unique and the list doesn't visibly stutter.
function dedupe(existing: Tweet[], incoming: Tweet[]): Tweet[] {
	const seen: Record<string, boolean> = {};
	for (let i = 0; i < existing.length; i++) seen[existing[i].id] = true;
	return incoming.filter(function (t: Tweet) {
		return !seen[t.id];
	});
}
