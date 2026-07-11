import type XAPI from "../api/xapi";
import { Header } from "../components";
import { TweetMedia } from "../components/media";
import { RepostMenu, TweetList, TweetText } from "../components/tweet";
import Icon from "../components/ui/Icon";
import {
	applyBookmark,
	applyLike,
	applyRetweet,
	commitBookmark,
	commitLike,
	commitRetweet
} from "../services/engagementService";
import { loadConversation } from "../services/timelineLoader";
import { getColors } from "../theme";
import type { ThemeMode } from "../theme";
import type { TimelinePage, Tweet, XUser } from "../types/x";
import { getAvatarColor } from "../utils/avatar";
import { logger } from "../utils/logger";
import { abbreviateCount, fullTimestamp } from "../utils/tweetFormat";
import React, { Component } from "react";
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

// Focal tweet spans the full width minus its horizontal padding (14 each side).
const FOCAL_MEDIA_W: number = Dimensions.get("window").width - 28;

export interface TweetDetailProps {
	themeMode: ThemeMode;
	api: XAPI;
	tweetId: string;
	onBack: () => void;
	onOpenTweet: (tweet: Tweet) => void;
	onOpenAuthor: (user: XUser) => void;
	onReply: (tweet: Tweet) => void;
	onQuote: (tweet: Tweet) => void;
}

interface TweetDetailState {
	focal: Tweet | null;
	// Whether the focal tweet's Repost/Quote chooser is open.
	repostMenuOpen: boolean;
}

// A tweet and its reply thread. The focal tweet renders large as the list header
// (full timestamp, expanded stats, big action row); replies reuse the shared
// TweetList — including its optimistic engagement and pagination.
export default class TweetDetailScreen extends Component<TweetDetailProps, TweetDetailState> {
	constructor(props: TweetDetailProps) {
		super(props);
		this.state = { focal: null, repostMenuOpen: false };
		this._loadPage = this._loadPage.bind(this);
		this._openRepostMenu = this._openRepostMenu.bind(this);
		this._closeRepostMenu = this._closeRepostMenu.bind(this);
		this._onMenuRepost = this._onMenuRepost.bind(this);
		this._onMenuQuote = this._onMenuQuote.bind(this);
	}

	_openRepostMenu(): void {
		this.setState({ repostMenuOpen: true });
	}

	_closeRepostMenu(): void {
		this.setState({ repostMenuOpen: false });
	}

	_onMenuRepost(): void {
		const api = this.props.api;
		this._closeRepostMenu();
		this._engageFocal(applyRetweet, function (t: Tweet) {
			return commitRetweet(api, t.id, t.retweeted);
		});
	}

	_onMenuQuote(): void {
		const focal = this.state.focal;
		this._closeRepostMenu();
		if (focal) this.props.onQuote(focal);
	}

	// Single source of truth for the conversation fetch: TweetList drives it, and
	// the first (uncursored) page also yields the focal tweet for our header.
	async _loadPage(cursor?: string): Promise<TimelinePage> {
		const result = await loadConversation(this.props.api, this.props.tweetId, cursor);
		if (!cursor && result.focalTweet) {
			this.setState({ focal: result.focalTweet });
		}
		return { tweets: result.replies, bottomCursor: result.bottomCursor };
	}

	_engageFocal(apply: (t: Tweet) => Tweet, commit: (t: Tweet) => Promise<unknown>): void {
		const focal = this.state.focal;
		if (!focal) return;
		const optimistic = apply(focal);
		this.setState({ focal: optimistic });
		const self = this;
		commit(focal).catch(function (err: unknown) {
			logger.warn("TweetDetail.engage", "commit failed, reverting", err);
			self.setState({ focal: focal });
		});
	}

	_renderStat(count: number, label: string, c: ReturnType<typeof getColors>): React.ReactNode {
		if (!count) return null;
		return (
			<Text style={[styles.stat, { color: c.textTertiary }]}>
				<Text style={[styles.statNum, { color: c.textPrimary }]}>{abbreviateCount(count)}</Text> {label}
			</Text>
		);
	}

	_renderFocal(): React.ReactElement | null {
		const focal = this.state.focal;
		if (!focal) return null;
		const c = getColors();
		const api = this.props.api;
		const author = focal.author;
		const self = this;

		return (
			<View style={[styles.focal, { borderBottomColor: c.border }]}>
				<TouchableOpacity
					style={styles.focalHead}
					onPress={function () {
						self.props.onOpenAuthor(author);
					}}
					activeOpacity={0.7}>
					{author.avatarUrl ? (
						<Image
							source={{ uri: author.avatarUrl }}
							style={styles.focalAvatar}
						/>
					) : (
						<View
							style={[
								styles.focalAvatar,
								styles.avatarFallback,
								{ backgroundColor: getAvatarColor(author.id) }
							]}>
							<Text style={styles.avatarInitial}>{(author.name || "?").charAt(0).toUpperCase()}</Text>
						</View>
					)}
					<View style={styles.focalNames}>
						<View style={styles.focalNameRow}>
							<Text
								style={[styles.focalName, { color: c.textPrimary }]}
								numberOfLines={1}>
								{author.name}
							</Text>
							{author.verified ? (
								<Icon
									name="badge-check"
									size={16}
									color={c.accent}
								/>
							) : null}
						</View>
						<Text
							style={[styles.focalHandle, { color: c.textTertiary }]}
							numberOfLines={1}>
							@{author.handle}
						</Text>
					</View>
				</TouchableOpacity>

				{focal.text ? (
					<TweetText
						text={focal.text}
						style={[styles.focalText, { color: c.textPrimary }]}
					/>
				) : null}

				<TweetMedia
					media={focal.media}
					width={FOCAL_MEDIA_W}
				/>

				<Text style={[styles.timestamp, { color: c.textTertiary }]}>
					{fullTimestamp(focal.createdAt)}
				</Text>

				<View style={[styles.statsRow, { borderTopColor: c.border, borderBottomColor: c.border }]}>
					{this._renderStat(focal.retweetCount, "Reposts", c)}
					{this._renderStat(focal.quoteCount, "Quotes", c)}
					{this._renderStat(focal.likeCount, "Likes", c)}
					{this._renderStat(focal.viewCount || 0, "Views", c)}
				</View>

				<View style={styles.actionRow}>
					<TouchableOpacity
						style={styles.action}
						onPress={function () {
							self.props.onReply(focal);
						}}>
						<Icon
							name="message-circle"
							size={20}
							color={c.textTertiary}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.action}
						onPress={self._openRepostMenu}>
						<Icon
							name="repeat"
							size={20}
							color={focal.retweeted ? c.retweet : c.textTertiary}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.action}
						onPress={function () {
							self._engageFocal(applyLike, function (t: Tweet) {
								return commitLike(api, t.id, t.liked);
							});
						}}>
						<Icon
							name="heart"
							size={20}
							color={focal.liked ? c.like : c.textTertiary}
						/>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.action}
						onPress={function () {
							self._engageFocal(applyBookmark, function (t: Tweet) {
								return commitBookmark(api, t.id, t.bookmarked);
							});
						}}>
						<Icon
							name="bookmark"
							size={20}
							color={focal.bookmarked ? c.accent : c.textTertiary}
						/>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	render(): React.ReactNode {
		const c = getColors();
		return (
			<View style={{ flex: 1, backgroundColor: c.bg }}>
				<Header
					title="Post"
					onBack={this.props.onBack}
				/>
				<TweetList
					api={this.props.api}
					loadPage={this._loadPage}
					onOpenTweet={this.props.onOpenTweet}
					onOpenAuthor={this.props.onOpenAuthor}
					onReply={this.props.onReply}
					onQuote={this.props.onQuote}
					ListHeaderComponent={this._renderFocal()}
					emptyText="No replies yet."
				/>
				{this.state.repostMenuOpen && this.state.focal ? (
					<RepostMenu
						retweeted={this.state.focal.retweeted}
						onRepost={this._onMenuRepost}
						onQuote={this._onMenuQuote}
						onClose={this._closeRepostMenu}
					/>
				) : null}
			</View>
		);
	}
}

const styles = StyleSheet.create<{
	focal: ViewStyle;
	focalHead: ViewStyle;
	focalAvatar: ImageStyle;
	avatarFallback: ViewStyle;
	avatarInitial: TextStyle;
	focalNames: ViewStyle;
	focalNameRow: ViewStyle;
	focalName: TextStyle;
	focalHandle: TextStyle;
	focalText: TextStyle;
	timestamp: TextStyle;
	statsRow: ViewStyle;
	stat: TextStyle;
	statNum: TextStyle;
	actionRow: ViewStyle;
	action: ViewStyle;
}>({
	focal: {
		paddingHorizontal: 14,
		paddingTop: 10,
		paddingBottom: 4,
		borderBottomWidth: StyleSheet.hairlineWidth
	},
	focalHead: { flexDirection: "row", alignItems: "center" },
	focalAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
	avatarFallback: { alignItems: "center", justifyContent: "center" },
	avatarInitial: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
	focalNames: { flex: 1 },
	focalNameRow: { flexDirection: "row", alignItems: "center" },
	focalName: { fontSize: 16, fontWeight: "700", marginRight: 3 },
	focalHandle: { fontSize: 14 },
	focalText: { fontSize: 19, lineHeight: 26, marginTop: 12 },
	timestamp: { fontSize: 14, marginTop: 12, marginBottom: 10 },
	statsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		paddingVertical: 12,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderBottomWidth: StyleSheet.hairlineWidth
	},
	stat: { fontSize: 14, marginRight: 16 },
	statNum: { fontWeight: "700" },
	actionRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8 },
	action: { minWidth: 44, minHeight: 40, alignItems: "center", justifyContent: "center" }
});
