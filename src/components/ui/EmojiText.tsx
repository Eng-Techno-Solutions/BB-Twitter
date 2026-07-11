import { emojiTextStyle, splitEmoji } from "../../utils/emojiFont";
import React, { Component } from "react";
import { Text } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

// A <Text> that renders emoji runs in the bundled emoji font so they show on the
// Q20's Android 4.3 instead of tofu. Off Android splitEmoji() is a no-op, so this
// is a plain <Text>. Use for any user-controlled string (display names, bios)
// that can contain emoji. For tweet bodies use TweetText, which also linkifies.
export interface EmojiTextProps {
	text: string;
	style?: StyleProp<TextStyle>;
	numberOfLines?: number;
}

export default class EmojiText extends Component<EmojiTextProps> {
	shouldComponentUpdate(next: EmojiTextProps): boolean {
		return (
			this.props.text !== next.text ||
			this.props.style !== next.style ||
			this.props.numberOfLines !== next.numberOfLines
		);
	}

	render(): React.ReactNode {
		const { text, style, numberOfLines } = this.props;
		const segments = splitEmoji(text || "");
		const isPlain = segments.length === 1 && !segments[0].emoji;
		return (
			<Text
				style={style}
				numberOfLines={numberOfLines}>
				{isPlain
					? text
					: segments.map(function (seg, i: number) {
							if (!seg.emoji) return seg.value;
							return (
								<Text
									key={i}
									style={emojiTextStyle}>
									{seg.value}
								</Text>
							);
						})}
			</Text>
		);
	}
}
