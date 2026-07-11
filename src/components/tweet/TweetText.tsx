import { getColors } from "../../theme";
import React, { Component } from "react";
import { Linking, Platform, StyleSheet, Text } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

// Token-based tweet text renderer — the Twitter analog of SlackText, but tweets
// carry no bold/italic markup, so this only linkifies @handles, #hashtags,
// $cashtags, and URLs. Kept a PureComponent-style class (shouldComponentUpdate)
// because it renders inside every list row and must not re-parse on parent churn.

export interface TweetTextProps {
	text: string;
	style?: StyleProp<TextStyle>;
	numberOfLines?: number;
	onPressMention?: (handle: string) => void;
	onPressHashtag?: (tag: string) => void;
}

interface Token {
	type: "text" | "mention" | "hashtag" | "cashtag" | "url";
	value: string;
}

// One pass, one regex. Order in the alternation matters: URLs first so an
// @handle inside a URL isn't mis-tokenized. Deliberately ASCII-only (no `/u`
// flag, no `\p{L}`) — the Q20's ancient JSC throws on unicode property escapes,
// so we favor never crashing over matching non-Latin hashtags perfectly.
const TOKEN_RE = /(https?:\/\/[^\s]+)|(@\w{1,15})|(#\w+)|(\$[A-Za-z]{1,6})/g;

function tokenize(text: string): Token[] {
	const tokens: Token[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	TOKEN_RE.lastIndex = 0;
	while ((match = TOKEN_RE.exec(text)) !== null) {
		if (match.index > lastIndex) {
			tokens.push({ type: "text", value: text.substring(lastIndex, match.index) });
		}
		if (match[1]) tokens.push({ type: "url", value: match[1] });
		else if (match[2]) tokens.push({ type: "mention", value: match[2] });
		else if (match[3]) tokens.push({ type: "hashtag", value: match[3] });
		else if (match[4]) tokens.push({ type: "cashtag", value: match[4] });
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < text.length) {
		tokens.push({ type: "text", value: text.substring(lastIndex) });
	}
	return tokens;
}

function openUrl(url: string): void {
	if (Platform.OS === "web") {
		(window as unknown as { open: (u: string, t: string) => void }).open(url, "_blank");
	} else {
		Linking.openURL(url).catch(function () {});
	}
}

export default class TweetText extends Component<TweetTextProps> {
	shouldComponentUpdate(next: TweetTextProps): boolean {
		return (
			this.props.text !== next.text ||
			this.props.style !== next.style ||
			this.props.numberOfLines !== next.numberOfLines
		);
	}

	_renderToken(token: Token, key: number, accent: string): React.ReactNode {
		const self = this;
		if (token.type === "text") return token.value;
		if (token.type === "url") {
			return (
				<Text
					key={key}
					style={[styles.link, { color: accent }]}
					onPress={function () {
						openUrl(token.value);
					}}>
					{token.value.replace(/^https?:\/\//, "")}
				</Text>
			);
		}
		const onPress =
			token.type === "mention"
				? function () {
						if (self.props.onPressMention) self.props.onPressMention(token.value.slice(1));
					}
				: token.type === "hashtag"
					? function () {
							if (self.props.onPressHashtag) self.props.onPressHashtag(token.value);
						}
					: undefined;
		return (
			<Text
				key={key}
				style={[styles.entity, { color: accent }]}
				onPress={onPress}>
				{token.value}
			</Text>
		);
	}

	render(): React.ReactNode {
		const { text, style, numberOfLines } = this.props;
		if (!text) return null;
		const colors = getColors();
		const tokens = tokenize(text);
		const self = this;
		return (
			<Text
				style={style}
				numberOfLines={numberOfLines}>
				{tokens.map(function (token: Token, i: number) {
					return self._renderToken(token, i, colors.accent);
				})}
			</Text>
		);
	}
}

const styles = StyleSheet.create<{ link: TextStyle; entity: TextStyle }>({
	link: {},
	entity: {}
});
