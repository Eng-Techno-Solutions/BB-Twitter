import { getColors } from "../../theme";
// Body/quote text inherit the reader's chosen font size; other chrome (name,
// handle, timestamps, counts) stays fixed so only the post copy scales.
const BODY_LINE_HEIGHT_RATIO = 1.33;
import type { Tweet, XUser } from "../../types/x";
import { getAvatarColor } from "../../utils/avatar";
import { abbreviateCount, relativeTime } from "../../utils/tweetFormat";
import { TweetMedia } from "../media";
import EmojiText from "../ui/EmojiText";
import Icon from "../ui/Icon";
import { styles } from "./TweetItem.styles";
import TweetText from "./TweetText";
import React, { Component } from "react";
import { Image, Text, TouchableHighlight, TouchableOpacity, View } from "react-native";

export interface TweetItemProps {
	tweet: Tweet;
	nowMs: number;
	onPress: (tweet: Tweet) => void;
	onPressAuthor: (user: XUser) => void;
	onReply: (tweet: Tweet) => void;
	onRetweet: (tweet: Tweet) => void;
	onLike: (tweet: Tweet) => void;
	onBookmark: (tweet: Tweet) => void;
	// Reader-selected body font size (theme.getMessageFontSize()); quote text
	// renders one point smaller, matching the fixed 15/14 default relationship.
	fontSize: number;
}

// The core list row — rendered for every tweet in every feed, so it is a strict
// PureComponent: it re-renders only when its own engagement state changes, never
// on unrelated parent updates (the FlatList performance rule inherited from
// BBSlack's MessageItem). All engagement math lives upstream; this only renders.
export default class TweetItem extends Component<TweetItemProps> {
	shouldComponentUpdate(next: TweetItemProps): boolean {
		const a = this.props.tweet;
		const b = next.tweet;
		return (
			a.id !== b.id ||
			a.liked !== b.liked ||
			a.retweeted !== b.retweeted ||
			a.bookmarked !== b.bookmarked ||
			a.likeCount !== b.likeCount ||
			a.retweetCount !== b.retweetCount ||
			a.replyCount !== b.replyCount ||
			a.quoteCount !== b.quoteCount ||
			this.props.nowMs !== next.nowMs ||
			this.props.fontSize !== next.fontSize
		);
	}

	_renderAvatar(user: XUser, sizeStyle: object, fallbackStyle: object): React.ReactNode {
		if (user.avatarUrl) {
			return (
				<Image
					source={{ uri: user.avatarUrl }}
					style={sizeStyle}
				/>
			);
		}
		const initial = (user.name || user.handle || "?").charAt(0).toUpperCase();
		return (
			<View style={[sizeStyle, fallbackStyle, { backgroundColor: getAvatarColor(user.id) }]}>
				<Text style={styles.avatarInitial}>{initial}</Text>
			</View>
		);
	}

	_renderQuote(quoted: Tweet, colors: ReturnType<typeof getColors>): React.ReactNode {
		return (
			<View style={[styles.quote, { borderColor: colors.border }]}>
				<View style={styles.quoteHeader}>
					{quoted.author.avatarUrl ? (
						<Image
							source={{ uri: quoted.author.avatarUrl }}
							style={styles.quoteAvatar}
						/>
					) : null}
					<EmojiText
						style={[styles.quoteName, { color: colors.textPrimary }]}
						numberOfLines={1}
						text={quoted.author.name}
					/>
					<Text
						style={[styles.quoteHandle, { color: colors.textTertiary }]}
						numberOfLines={1}>
						@{quoted.author.handle}
					</Text>
				</View>
				<TweetText
					text={quoted.text}
					style={[
						styles.quoteText,
						{
							color: colors.textSecondary,
							fontSize: this.props.fontSize - 1,
							lineHeight: Math.round((this.props.fontSize - 1) * BODY_LINE_HEIGHT_RATIO)
						}
					]}
					numberOfLines={4}
				/>
			</View>
		);
	}

	_renderAction(
		icon: string,
		count: number,
		active: boolean,
		activeColor: string,
		baseColor: string,
		onPress: () => void
	): React.ReactNode {
		const color = active ? activeColor : baseColor;
		return (
			<TouchableOpacity
				style={styles.action}
				onPress={onPress}
				activeOpacity={0.6}
				data-type="tweet-action">
				<Icon
					name={icon}
					size={17}
					color={color}
				/>
				{count > 0 ? (
					<Text style={[styles.actionCount, { color: color }]}>{abbreviateCount(count)}</Text>
				) : null}
			</TouchableOpacity>
		);
	}

	render(): React.ReactNode {
		const { tweet, nowMs, onPress, onPressAuthor, onReply, onRetweet, onLike, onBookmark } =
			this.props;
		const colors = getColors();
		const author = tweet.author;

		return (
			<TouchableHighlight
				underlayColor={colors.messageUnderlay}
				onPress={function () {
					onPress(tweet);
				}}
				data-type="tweet-row">
				<View
					style={[styles.container, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
					{tweet.retweetedBy ? (
						<View style={styles.repostAttr}>
							<Icon
								name="repeat"
								size={13}
								color={colors.textTertiary}
							/>
							<EmojiText
								style={[styles.repostAttrText, { color: colors.textTertiary }]}
								numberOfLines={1}
								text={tweet.retweetedBy.name + " reposted"}
							/>
						</View>
					) : null}

					<View style={styles.row}>
						<TouchableOpacity
							style={styles.avatarCol}
							onPress={function () {
								onPressAuthor(author);
							}}
							activeOpacity={0.7}>
							{this._renderAvatar(author, styles.avatar, styles.avatarFallback)}
						</TouchableOpacity>

						<View style={styles.contentCol}>
							<View style={styles.headerRow}>
								<EmojiText
									style={[styles.name, { color: colors.textPrimary }]}
									numberOfLines={1}
									text={author.name}
								/>
								{author.verified ? (
									<Icon
										name="badge-check"
										size={15}
										color={colors.accent}
									/>
								) : null}
								<Text
									style={[styles.handle, { color: colors.textTertiary }]}
									numberOfLines={1}>
									@{author.handle}
								</Text>
								<Text style={[styles.dot, { color: colors.textTertiary }]}>·</Text>
								<Text style={[styles.time, { color: colors.textTertiary }]}>
									{relativeTime(tweet.createdAt, nowMs)}
								</Text>
							</View>

							{tweet.inReplyToHandle ? (
								<Text style={[styles.replyingTo, { color: colors.textTertiary }]}>
									Replying to <Text style={{ color: colors.accent }}>@{tweet.inReplyToHandle}</Text>
								</Text>
							) : null}

							{tweet.text ? (
								<TweetText
									text={tweet.text}
									style={[
										styles.text,
										{
											color: colors.textPrimary,
											fontSize: this.props.fontSize,
											lineHeight: Math.round(this.props.fontSize * BODY_LINE_HEIGHT_RATIO)
										}
									]}
								/>
							) : null}

							<TweetMedia media={tweet.media} />
							{tweet.quoted ? this._renderQuote(tweet.quoted, colors) : null}

							<View style={styles.actionRow}>
								{this._renderAction(
									"message-circle",
									tweet.replyCount,
									false,
									colors.accent,
									colors.textTertiary,
									function () {
										onReply(tweet);
									}
								)}
								{this._renderAction(
									"repeat",
									tweet.retweetCount,
									tweet.retweeted,
									colors.retweet,
									colors.textTertiary,
									function () {
										onRetweet(tweet);
									}
								)}
								{this._renderAction(
									"heart",
									tweet.likeCount,
									tweet.liked,
									colors.like,
									colors.textTertiary,
									function () {
										onLike(tweet);
									}
								)}
								{this._renderAction(
									"bar-chart",
									tweet.viewCount || 0,
									false,
									colors.accent,
									colors.textTertiary,
									function () {
										onPress(tweet);
									}
								)}
								{this._renderAction(
									"bookmark",
									0,
									tweet.bookmarked,
									colors.accent,
									colors.textTertiary,
									function () {
										onBookmark(tweet);
									}
								)}
							</View>
						</View>
					</View>
				</View>
			</TouchableHighlight>
		);
	}
}
