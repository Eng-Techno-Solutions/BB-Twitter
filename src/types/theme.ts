export interface ThemeColors {
	bg: string;
	bgSecondary: string;
	bgTertiary: string;
	bgHeader: string;
	bgSplash: string;
	statusBar: string;
	statusBarStyle: "default" | "light-content" | "dark-content";
	headerText: string;
	headerIcon: string;
	headerBorder: string;
	tabText: string;
	tabTextActive: string;
	border: string;
	borderInput: string;
	textPrimary: string;
	textSecondary: string;
	textTertiary: string;
	textPlaceholder: string;
	accent: string;
	accentLight: string;
	error: string;
	purple: string;
	green: string;
	like: string; // heart / like action (X pink)
	retweet: string; // repost action (X green)
	splash: string;
	codeBlockBg: string;
	codeInlineBg: string;
	codeInlineColor: string;
	codeBorder: string;
	channelAvatarBg: string;
	avatarPlaceholderBg: string;
	messageUnderlay: string;
	listUnderlay: string;
	actionUnderlay: string;
	reactionActiveBg: string;
	mentionBg: string;
	overlayLight: string;
	overlayMedium: string;
	overlayHeavy: string;
	scrollBtnBg: string;
	badgeBg: string;
	systemLine: string;
	tooltipBg: string;
	fileIconBg: string;
}

export type ThemeMode = "dark" | "light";
export type FontSizeKey = "small" | "medium" | "large";
