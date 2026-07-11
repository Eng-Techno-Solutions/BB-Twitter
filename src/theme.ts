import type { FontSizeKey, ThemeColors, ThemeMode } from "./types/theme";

export type { ThemeColors, ThemeMode, FontSizeKey };

// BB10-native charcoal surfaces carrying the X accent blue. Neutral graphite
// greys (not X's navy "dim") read as BlackBerry Cascades; the accent, like,
// and retweet colors keep it legibly "Twitter".
const darkColors: ThemeColors = {
	bg: "#101318",
	bgSecondary: "#0A0C10",
	bgTertiary: "#181C22",
	bgHeader: "#101318",
	bgSplash: "#0A0C10",
	statusBar: "#0A0C10",
	statusBarStyle: "light-content",
	headerText: "#E7E9EA",
	headerIcon: "#E7E9EA",
	headerBorder: "rgba(255,255,255,0.08)",
	tabText: "#71767B",
	tabTextActive: "#E7E9EA",
	border: "#2F3336",
	borderInput: "#3E4144",
	textPrimary: "#E7E9EA",
	textSecondary: "#C4C7CC",
	textTertiary: "#71767B",
	textPlaceholder: "#565A5F",
	accent: "#1D9BF0",
	accentLight: "#1D9BF0",
	error: "#F4212E",
	purple: "#794BC4",
	green: "#00BA7C",
	like: "#F91880",
	retweet: "#00BA7C",
	splash: "#1D9BF0",
	codeBlockBg: "#16181C",
	codeInlineBg: "#22252A",
	codeInlineColor: "#E8912D",
	codeBorder: "#2F3336",
	channelAvatarBg: "#2F3336",
	avatarPlaceholderBg: "#1D9BF0",
	messageUnderlay: "rgba(255, 255, 255, 0.04)",
	listUnderlay: "rgba(29, 155, 240, 0.12)",
	actionUnderlay: "rgba(255, 255, 255, 0.1)",
	reactionActiveBg: "rgba(29, 155, 240, 0.15)",
	mentionBg: "rgba(29, 155, 240, 0.1)",
	overlayLight: "rgba(0,0,0,0.6)",
	overlayMedium: "rgba(0,0,0,0.7)",
	overlayHeavy: "rgba(0,0,0,0.92)",
	scrollBtnBg: "#1D9BF0",
	badgeBg: "#F4212E",
	systemLine: "#2F3336",
	tooltipBg: "#101318",
	fileIconBg: "#2F3336"
};

const lightColors: ThemeColors = {
	bg: "#FFFFFF",
	bgSecondary: "#FFFFFF",
	bgTertiary: "#F7F9F9",
	bgHeader: "#FFFFFF",
	bgSplash: "#FFFFFF",
	statusBar: "#FFFFFF",
	statusBarStyle: "dark-content",
	headerText: "#0F1419",
	headerIcon: "#0F1419",
	headerBorder: "rgba(0,0,0,0.1)",
	tabText: "#536471",
	tabTextActive: "#0F1419",
	border: "#EFF3F4",
	borderInput: "#CFD9DE",
	textPrimary: "#0F1419",
	textSecondary: "#536471",
	textTertiary: "#536471",
	textPlaceholder: "#687684",
	accent: "#1D9BF0",
	accentLight: "#1D9BF0",
	error: "#F4212E",
	purple: "#794BC4",
	green: "#00BA7C",
	like: "#F91880",
	retweet: "#00BA7C",
	splash: "#1D9BF0",
	codeBlockBg: "#F7F9F9",
	codeInlineBg: "#EFF3F4",
	codeInlineColor: "#C73100",
	codeBorder: "#EFF3F4",
	channelAvatarBg: "#EFF3F4",
	avatarPlaceholderBg: "#1D9BF0",
	messageUnderlay: "rgba(0, 0, 0, 0.05)",
	listUnderlay: "rgba(29, 155, 240, 0.1)",
	actionUnderlay: "rgba(0, 0, 0, 0.08)",
	reactionActiveBg: "rgba(29, 155, 240, 0.1)",
	mentionBg: "rgba(29, 155, 240, 0.08)",
	overlayLight: "rgba(0,0,0,0.4)",
	overlayMedium: "rgba(0,0,0,0.5)",
	overlayHeavy: "rgba(0,0,0,0.8)",
	scrollBtnBg: "#1D9BF0",
	badgeBg: "#F4212E",
	systemLine: "#EFF3F4",
	tooltipBg: "#FFFFFF",
	fileIconBg: "#EFF3F4"
};

let currentMode: ThemeMode = "dark";
let currentFontSize: FontSizeKey = "medium";
const FONT_SIZES: Record<FontSizeKey, number> = { small: 13, medium: 15, large: 17 };

function getColors(): ThemeColors {
	return currentMode === "dark" ? darkColors : lightColors;
}

function getMode(): ThemeMode {
	return currentMode;
}

function setMode(mode: ThemeMode): void {
	currentMode = mode;
}

function getMessageFontSize(): number {
	return FONT_SIZES[currentFontSize] || 15;
}

function getFontSizeKey(): FontSizeKey {
	return currentFontSize;
}

function setFontSizeKey(key: FontSizeKey): void {
	currentFontSize = key;
}

export { getColors, getMode, setMode, getMessageFontSize, getFontSizeKey, setFontSizeKey };
