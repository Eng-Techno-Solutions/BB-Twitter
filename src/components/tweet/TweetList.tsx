import type XAPI from "../../api/xapi";
import {
	applyBookmark,
	applyLike,
	applyRetweet,
	commitBookmark,
	commitLike,
	commitRetweet
} from "../../services/engagementService";
import { getColors } from "../../theme";
import type { TimelinePage, Tweet, XUser } from "../../types/x";
import { errorMessage } from "../../utils/error";
import { logger } from "../../utils/logger";
import { ErrorView } from "../ui";
import TweetItem from "./TweetItem";
import React, { Component } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import type { ListRenderItemInfo } from "react-native";

export interface TweetListProps {
	api: XAPI;
	loadPage: (cursor?: string) => Promise<TimelinePage>;
	onOpenTweet: (tweet: Tweet) => void;
	onOpenAuthor: (user: XUser) => void;
	onReply: (tweet: Tweet) => void;
	ListHeaderComponent?: React.ReactElement | null;
	emptyText?: string;
}

interface TweetListState {
	tweets: Tweet[];
	cursor?: string;
	loading: boolean;
	refreshing: boolean;
	loadingMore: boolean;
	error: string | null;
	nowMs: number;
}

// The reusable feed. Home / Profile tabs / Bookmarks / Search results all render
// an engageable tweet list that differs only in WHICH page-loader they pass — so
// the FlatList, pull-to-refresh, infinite scroll, optimistic engagement, and Q20
// list-perf tuning live here once (DRY), and screens stay thin.
export default class TweetList extends Component<TweetListProps, TweetListState> {
	_mounted: boolean;

	constructor(props: TweetListProps) {
		super(props);
		this.state = {
			tweets: [],
			cursor: undefined,
			loading: true,
			refreshing: false,
			loadingMore: false,
			error: null,
			nowMs: Date.now()
		};
		this._mounted = false;
		this._renderItem = this._renderItem.bind(this);
		this._keyExtractor = this._keyExtractor.bind(this);
		this._onEndReached = this._onEndReached.bind(this);
		this._refresh = this._refresh.bind(this);
	}

	componentDidMount(): void {
		this._mounted = true;
		this._initialLoad();
	}

	componentWillUnmount(): void {
		this._mounted = false;
	}

	async _initialLoad(): Promise<void> {
		try {
			const page = await this.props.loadPage();
			if (!this._mounted) return;
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
		this.setState(function (prev: TweetListState) {
			const tweets = prev.tweets.map(function (t: Tweet) {
				return t.id === updated.id ? updated : t;
			});
			return { tweets: tweets } as TweetListState;
		});
	}

	_onLike = (tweet: Tweet): void => {
		const api = this.props.api;
		this._engage(tweet, applyLike, function () {
			return commitLike(api, tweet.id, tweet.liked);
		});
	};

	_onRetweet = (tweet: Tweet): void => {
		const api = this.props.api;
		this._engage(tweet, applyRetweet, function () {
			return commitRetweet(api, tweet.id, tweet.retweeted);
		});
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

		return (
			<FlatList
				style={{ flex: 1, backgroundColor: c.bg }}
				data={tweets}
				keyExtractor={this._keyExtractor}
				renderItem={this._renderItem}
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
