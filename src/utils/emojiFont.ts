import { Platform } from "react-native";
import type { TextStyle } from "react-native";
import emojiRegex from "emoji-regex";

// The Q20 runs Android 4.3, whose system font ships no emoji glyphs: raw emoji
// render as tofu boxes and flags collapse to their regional-indicator letters
// (🇪🇬 → "EG"). We bundle the monochrome Noto Emoji outline font
// (android/app/src/main/assets/fonts/NotoEmoji-Regular.ttf) and render emoji runs
// in it. Only Android needs this — web browsers render emoji natively — so off
// Android splitEmoji() is a no-op and text renders unwrapped.
const isEmojiFontEnabled = Platform.OS === "android";

// fontFamily only — nested <Text> inherits color/fontSize from its parent, so
// emoji match the surrounding text size and theme color.
export const emojiTextStyle: TextStyle = { fontFamily: "NotoEmoji-Regular" };

export interface TextSegment {
	emoji: boolean;
	value: string;
}

// Splits a string into alternating plain-text and emoji runs. emoji-regex 9.x
// matches via \uXXXX surrogate escapes with the /g flag only — no /u flag and no
// \p{} property escapes, both of which crash the Q20's ancient JSC.
export function splitEmoji(text: string): TextSegment[] {
	if (!isEmojiFontEnabled || !text) return [{ emoji: false, value: text }];
	const re = emojiRegex();
	const segments: TextSegment[] = [];
	let last = 0;
	let match: RegExpExecArray | null;
	while ((match = re.exec(text)) !== null) {
		if (match.index > last) {
			segments.push({ emoji: false, value: text.substring(last, match.index) });
		}
		segments.push({ emoji: true, value: match[0] });
		last = match.index + match[0].length;
	}
	if (last < text.length) {
		segments.push({ emoji: false, value: text.substring(last) });
	}
	return segments.length ? segments : [{ emoji: false, value: text }];
}
