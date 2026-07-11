import type XAPI from "../api/xapi";
import type { HomeTab } from "../services/timelineLoader";
import type { FontSizeKey, ThemeMode } from "../theme";
import type { XUser } from "./x";
import type { ViewStyle } from "react-native";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A stored X login. The session pair (auth_token + ct0) plus enough identity to
// render the account switcher without a network call.
export interface XAccount {
	authToken: string;
	csrf: string;
	userId: string;
	handle: string;
	name: string;
	avatarUrl: string;
}

export interface StackEntry {
	screen: string;
	params: Record<string, any>;
}

// The five bottom-tab destinations (BB10 action-bar tabs).
export type TabKey = "home" | "search" | "notifications" | "messages" | "profile";

export interface AppProps {}

export interface AppState {
	initializing: boolean;
	api: XAPI | null;
	currentUser: XUser | null;
	accounts: XAccount[];
	stack: StackEntry[];
	activeTab: TabKey;
	homeTab: HomeTab;
	themeMode: ThemeMode;
	notifInterval: number;
	notifEnabled: boolean;
	soundEnabled: boolean;
	fontSize: FontSizeKey;
	unreadNotifications: number;
}

export interface AppStyles {
	app: ViewStyle;
	splash: ViewStyle;
}
