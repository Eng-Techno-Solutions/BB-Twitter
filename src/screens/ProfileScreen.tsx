import type XAPI from "../api/xapi";
import { Header } from "../components";
import { TweetList } from "../components/tweet";
import Icon from "../components/ui/Icon";
import {
	loadUserLikes,
	loadUserMedia,
	loadUserReplies,
	loadUserTweets
} from "../services/timelineLoader";
import { getColors } from "../theme";
import type { ThemeMode } from "../theme";
import type { TimelinePage, Tweet, XUser } from "../types/x";
import { getAvatarColor } from "../utils/avatar";
import { logger } from "../utils/logger";
import { abbreviateCount } from "../utils/tweetFormat";
import React, { Component } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

export interface ProfileProps {
	themeMode: ThemeMode;
	api: XAPI;
	user: XUser;
	isSelf: boolean;
	onBack: (() => void) | null;
	onOpenTweet: (tweet: Tweet) => void;
	onOpenAuthor: (user: XUser) => void;
	onReply: (tweet: Tweet) => void;
	onSettings?: () => void;
}

type ProfileTab = "posts" | "replies" | "media" | "likes";

interface ProfileState {
	following: boolean;
	tab: ProfileTab;
}

const PROFILE_TABS: Array<{ key: ProfileTab; label: string }> = [
	{ key: "posts", label: "Posts" },
	{ key: "replies", label: "Replies" },
	{ key: "media", label: "Media" },
	{ key: "likes", label: "Likes" }
];

// A user's profile: a header card (avatar, bio, follow counts) over the shared
// TweetList of their posts. Self-profile shows a Settings affordance; others show
// Follow (optimistic — flips instantly, commits in the background, reverts on
// failure, same posture as tweet engagement). Timeline reuses the Home feed engine.
export default class ProfileScreen extends Component<ProfileProps, ProfileState> {
	constructor(props: ProfileProps) {
		super(props);
		this.state = { following: Boolean(props.user.following), tab: "posts" };
		this._loadPage = this._loadPage.bind(this);
	}

	// One loader per profile sub-tab; the shared TweetList (remounted per tab)
	// handles the rest. Loaders already existed in timelineLoader — this just routes.
	_loadPage(cursor?: string): Promise<TimelinePage> {
		const { api, user } = this.props;
		if (this.state.tab === "replies") return loadUserReplies(api, user.id, cursor);
		if (this.state.tab === "media") return loadUserMedia(api, user.id, cursor);
		if (this.state.tab === "likes") return loadUserLikes(api, user.id, cursor);
		return loadUserTweets(api, user.id, cursor);
	}

	_toggleFollow = (): void => {
		const wasFollowing = this.state.following;
		this.setState({ following: !wasFollowing });
		const call = wasFollowing
			? this.props.api.unfollow(this.props.user.id)
			: this.props.api.follow(this.props.user.id);
		const self = this;
		call.catch(function (err: unknown) {
			logger.warn("Profile.follow", "commit failed, reverting", err);
			self.setState({ following: wasFollowing });
		});
	};

	_renderHeader(): React.ReactElement {
		const c = getColors();
		const self = this;
		const { user, isSelf } = this.props;
		const following = this.state.following;
		return (
			<View style={{ backgroundColor: c.bg }}>
				<View
					style={[styles.banner, { backgroundColor: user.bannerUrl ? "transparent" : c.bgTertiary }]}>
					{user.bannerUrl ? (
						<Image
							source={{ uri: user.bannerUrl }}
							style={styles.bannerImg}
							resizeMode="cover"
						/>
					) : null}
				</View>
				<View style={styles.headerBody}>
					<View style={styles.avatarRow}>
						{user.avatarUrl ? (
							<Image
								source={{ uri: user.avatarUrl }}
								style={[styles.avatar, { borderColor: c.bg }]}
							/>
						) : (
							<View
								style={[
									styles.avatar,
									styles.avatarFallback,
									{ backgroundColor: getAvatarColor(user.id), borderColor: c.bg }
								]}>
								<Text style={styles.avatarInitial}>{(user.name || "?").charAt(0).toUpperCase()}</Text>
							</View>
						)}
						{isSelf ? null : (
							<TouchableOpacity
								style={[
									styles.followBtn,
									following ? { borderColor: c.border } : { backgroundColor: c.accent }
								]}
								onPress={this._toggleFollow}
								data-type="btn">
								<Text style={[styles.followText, { color: following ? c.textPrimary : "#FFFFFF" }]}>
									{following ? "Following" : "Follow"}
								</Text>
							</TouchableOpacity>
						)}
					</View>

					<View style={styles.nameRow}>
						<Text style={[styles.name, { color: c.textPrimary }]}>{user.name}</Text>
						{user.verified ? (
							<Icon
								name="badge-check"
								size={17}
								color={c.accent}
							/>
						) : null}
					</View>
					<Text style={[styles.handle, { color: c.textTertiary }]}>@{user.handle}</Text>
					{user.bio ? <Text style={[styles.bio, { color: c.textPrimary }]}>{user.bio}</Text> : null}

					<View style={styles.counts}>
						<Text style={[styles.count, { color: c.textTertiary }]}>
							<Text style={[styles.countNum, { color: c.textPrimary }]}>
								{abbreviateCount(user.followingCount || 0)}
							</Text>{" "}
							Following
						</Text>
						<Text style={[styles.count, { color: c.textTertiary }]}>
							<Text style={[styles.countNum, { color: c.textPrimary }]}>
								{abbreviateCount(user.followersCount || 0)}
							</Text>{" "}
							Followers
						</Text>
					</View>
				</View>
				<View style={[styles.tabsBar, { borderBottomColor: c.border }]}>
					{PROFILE_TABS.map(function (t: { key: ProfileTab; label: string }) {
						const active = t.key === self.state.tab;
						return (
							<TouchableOpacity
								key={t.key}
								style={styles.tab}
								onPress={function () {
									self.setState({ tab: t.key });
								}}
								data-type="profile-tab">
								<Text
									style={[
										styles.tabLabel,
										{ color: active ? c.textPrimary : c.tabText },
										active && { borderBottomColor: c.accent, borderBottomWidth: 3 }
									]}>
									{t.label}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>
		);
	}

	render(): React.ReactNode {
		const c = getColors();
		const { user, isSelf } = this.props;
		return (
			<View style={{ flex: 1, backgroundColor: c.bg }}>
				<Header
					title={user.name || "Profile"}
					subtitle={user.handle ? "@" + user.handle : undefined}
					onBack={this.props.onBack || undefined}
					rightIcon={isSelf ? "settings" : undefined}
					onRight={isSelf ? this.props.onSettings : undefined}
				/>
				<TweetList
					key={this.state.tab}
					api={this.props.api}
					loadPage={this._loadPage}
					onOpenTweet={this.props.onOpenTweet}
					onOpenAuthor={this.props.onOpenAuthor}
					onReply={this.props.onReply}
					ListHeaderComponent={this._renderHeader()}
					emptyText="Nothing here yet."
				/>
			</View>
		);
	}
}

const styles = StyleSheet.create<{
	banner: ViewStyle;
	bannerImg: ImageStyle;
	headerBody: ViewStyle;
	avatarRow: ViewStyle;
	avatar: ImageStyle;
	avatarFallback: ViewStyle;
	avatarInitial: TextStyle;
	followBtn: ViewStyle;
	followText: TextStyle;
	nameRow: ViewStyle;
	name: TextStyle;
	handle: TextStyle;
	bio: TextStyle;
	counts: ViewStyle;
	count: TextStyle;
	countNum: TextStyle;
	tabsBar: ViewStyle;
	tab: ViewStyle;
	tabLabel: TextStyle;
}>({
	banner: { height: 120 },
	bannerImg: { width: "100%", height: 120 },
	headerBody: { paddingHorizontal: 14 },
	avatarRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		marginTop: -34
	},
	avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 4 },
	avatarFallback: { alignItems: "center", justifyContent: "center" },
	avatarInitial: { color: "#FFFFFF", fontSize: 28, fontWeight: "bold" },
	followBtn: {
		borderWidth: 1,
		borderRadius: 18,
		paddingHorizontal: 16,
		paddingVertical: 7,
		marginBottom: 6
	},
	followText: { fontSize: 14, fontWeight: "700" },
	nameRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
	name: { fontSize: 20, fontWeight: "800", marginRight: 4 },
	handle: { fontSize: 15, marginTop: 1 },
	bio: { fontSize: 15, lineHeight: 20, marginTop: 8 },
	counts: { flexDirection: "row", marginTop: 12, marginBottom: 12 },
	count: { fontSize: 14, marginRight: 20 },
	countNum: { fontWeight: "700" },
	tabsBar: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
	tab: { flex: 1, alignItems: "center" },
	tabLabel: { fontSize: 14, fontWeight: "700", paddingVertical: 12 }
});
