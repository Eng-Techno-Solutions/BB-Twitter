import { styles } from "./App.styles";
import XAPI from "./api/xapi";
import { ErrorBoundary, TabBar } from "./components";
import {
	BookmarksScreen,
	ComposeScreen,
	DMConversationScreen,
	HomeScreen,
	LoginScreen,
	MessagesScreen,
	NotificationsScreen,
	ProfileScreen,
	SearchScreen,
	SettingsScreen,
	TweetDetailScreen
} from "./screens";
import {
	authenticate,
	getResetState,
	persistAccountLogin,
	removeAccount,
	tryAutoLogin,
	upsertAccount
} from "./services/accountManager";
import { loadUnreadCount } from "./services/notificationsService";
import type { HomeTab } from "./services/timelineLoader";
import { clearViews } from "./services/viewCache";
import { getColors, setFontSizeKey, setMode } from "./theme";
import type { FontSizeKey } from "./theme";
import type { AppProps as Props, StackEntry, AppState as State, TabKey } from "./types/app";
import type { DMConversation, Tweet, XUser } from "./types/x";
import { clearToken, logger } from "./utils";
import { errorMessage } from "./utils/error";
import {
	getFontSize,
	getNotifEnabled,
	getSoundEnabled,
	getTheme,
	saveFontSize,
	saveNotifEnabled,
	saveSoundEnabled,
	saveTheme
} from "./utils/storage";
import type { XSession } from "./utils/storage";
import React, { Component } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";

// The five bottom-tab destinations map 1:1 to a root screen name.
const TAB_SCREEN: Record<TabKey, string> = {
	home: "home",
	search: "search",
	notifications: "notifications",
	messages: "messages",
	profile: "profile"
};
const TAB_ROOTS = ["home", "search", "notifications", "messages", "profile"];

// Web entry. Owns all global state and drives manual stack navigation + the
// bottom tab bar — same architecture as BBSlack's App (class component, props
// drilling, `state.stack`), remapped to X's destinations.
export default class App extends Component<Props, State> {
	_badgeTimer: ReturnType<typeof setInterval> | null;

	constructor(props: Props) {
		super(props);
		this.state = {
			initializing: true,
			api: null,
			currentUser: null,
			accounts: [],
			stack: [{ screen: "login", params: {} }],
			activeTab: "home",
			homeTab: "forYou",
			themeMode: "dark",
			notifInterval: 120000,
			notifEnabled: true,
			soundEnabled: true,
			fontSize: "medium",
			unreadNotifications: 0
		};
		this._badgeTimer = null;
	}

	componentDidMount(): void {
		this._initTheme();
		this._initSettings();
		this._autoLogin();
	}

	componentWillUnmount(): void {
		this._stopBadgePolling();
	}

	// ── Unread badge ───────────────────────────────────────
	// Poll the cheap badge-count endpoint so the Notifications tab shows an unread
	// count. Conservative interval (reuses notifInterval) — no websocket to lean on.
	_startBadgePolling(api: XAPI): void {
		this._stopBadgePolling();
		const self = this;
		const poll = function () {
			loadUnreadCount(api).then(function (count: number) {
				self.setState({ unreadNotifications: count });
			});
		};
		poll();
		this._badgeTimer = setInterval(poll, this.state.notifInterval || 120000);
	}

	_stopBadgePolling(): void {
		if (this._badgeTimer) {
			clearInterval(this._badgeTimer);
			this._badgeTimer = null;
		}
	}

	// ── Theme & settings ───────────────────────────────────
	async _initTheme(): Promise<void> {
		try {
			const mode = await getTheme();
			setMode(mode);
			this.setState({ themeMode: mode });
			this._applyThemeToDOM(mode);
		} catch (err: unknown) {
			logger.warn("App.initTheme", "failed to load theme", err);
		}
	}

	_applyThemeToDOM(mode: string): void {
		try {
			document.documentElement.setAttribute("data-theme", mode);
		} catch (_err) {
			// Non-web platforms have no `document`; intentional no-op.
		}
	}

	async _initSettings(): Promise<void> {
		try {
			const notifEnabled = await getNotifEnabled();
			const soundEnabled = await getSoundEnabled();
			const fontSize = await getFontSize();
			setFontSizeKey(fontSize);
			this.setState({ notifEnabled: notifEnabled, soundEnabled: soundEnabled, fontSize: fontSize });
		} catch (err: unknown) {
			logger.warn("App.initSettings", "failed to load settings", err);
		}
	}

	_toggleTheme = (): void => {
		const mode = this.state.themeMode === "dark" ? "light" : "dark";
		setMode(mode);
		this.setState({ themeMode: mode });
		this._applyThemeToDOM(mode);
		saveTheme(mode);
	};

	_toggleNotif = (): void => {
		const enabled = !this.state.notifEnabled;
		this.setState({ notifEnabled: enabled });
		saveNotifEnabled(enabled);
	};

	_toggleSound = (): void => {
		const enabled = !this.state.soundEnabled;
		this.setState({ soundEnabled: enabled });
		saveSoundEnabled(enabled);
	};

	_changeFontSize = (size: FontSizeKey): void => {
		setFontSizeKey(size);
		this.setState({ fontSize: size });
		saveFontSize(size);
	};

	_changeHomeTab = (tab: HomeTab): void => {
		this.setState({ homeTab: tab });
	};

	// ── Auth ───────────────────────────────────────────────
	async _autoLogin(): Promise<void> {
		try {
			const result = await tryAutoLogin();
			if (result.accounts.length > 0) this.setState({ accounts: result.accounts });
			if (result.session) {
				await this.doLogin(result.session);
			} else {
				this.setState({ initializing: false });
			}
		} catch (err: unknown) {
			logger.warn("App.autoLogin", "auto-login failed", err);
			this.setState({ initializing: false });
		}
	}

	doLogin = async (session: XSession): Promise<void> => {
		let user: XUser;
		try {
			user = await authenticate(session);
		} catch (err: unknown) {
			this.setState({ initializing: false });
			throw new Error(errorMessage(err, "Sign in failed"));
		}
		const api = new XAPI(session);
		const accounts = upsertAccount(this.state.accounts, user, session);
		await persistAccountLogin(accounts, user.id);
		// New session boundary (login / account switch): drop the previous
		// account's cached views so we never render them under the new user.
		clearViews();
		this.setState({
			api: api,
			currentUser: user,
			accounts: accounts,
			activeTab: "home",
			stack: [{ screen: "home", params: {} }],
			initializing: false
		});
		this._startBadgePolling(api);
	};

	handleLogout = async (): Promise<void> => {
		this._stopBadgePolling();
		const accounts = await removeAccount(
			this.state.accounts,
			this.state.currentUser ? this.state.currentUser.id : ""
		);
		await clearToken();
		clearViews();
		this.setState(Object.assign({}, getResetState(), { accounts: accounts, initializing: false }));
	};

	// ── Navigation ─────────────────────────────────────────
	navigate = (screen: string, params?: Record<string, unknown>): void => {
		this.setState(function (prev: State) {
			return { stack: prev.stack.concat([{ screen: screen, params: params || {} }]) };
		});
	};

	goBack = (): void => {
		this.setState(function (prev: State) {
			if (prev.stack.length <= 1) return null;
			return { stack: prev.stack.slice(0, -1) };
		});
	};

	selectTab = (tab: TabKey): void => {
		// Opening Notifications clears the unread badge (you've seen them).
		const unread = tab === "notifications" ? 0 : this.state.unreadNotifications;
		this.setState({
			activeTab: tab,
			stack: [{ screen: TAB_SCREEN[tab], params: {} }],
			unreadNotifications: unread
		});
	};

	// ── Shared tweet handlers (passed to every feed) ───────
	_openTweet = (tweet: Tweet): void => {
		this.navigate("tweetDetail", { tweetId: tweet.id });
	};

	_openAuthor = (user: XUser): void => {
		const isSelf = Boolean(this.state.currentUser && user.id === this.state.currentUser.id);
		this.navigate("profile", { user: user, isSelf: isSelf });
	};

	_reply = (tweet: Tweet): void => {
		this.navigate("compose", { mode: "reply", target: tweet });
	};

	_quote = (tweet: Tweet): void => {
		this.navigate("compose", { mode: "quote", target: tweet });
	};

	_compose = (): void => {
		this.navigate("compose", { mode: "tweet" });
	};

	// ── Screen rendering ───────────────────────────────────
	renderScreen(): React.ReactElement | null {
		const state = this.state;
		const stack = state.stack;
		const current = stack[stack.length - 1];
		const params = current.params || {};
		const api = state.api;
		const backOnStack = stack.length > 1 ? this.goBack : null;

		if (current.screen === "login" || !api) {
			return (
				<LoginScreen
					themeMode={state.themeMode}
					onLogin={this.doLogin}
					onBack={stack.length > 1 ? this.goBack : null}
				/>
			);
		}

		switch (current.screen) {
			case "home":
				return (
					<HomeScreen
						themeMode={state.themeMode}
						api={api}
						initialTab={state.homeTab}
						onOpenTweet={this._openTweet}
						onOpenAuthor={this._openAuthor}
						onReply={this._reply}
						onQuote={this._quote}
						onCompose={this._compose}
						onTabChange={this._changeHomeTab}
					/>
				);
			case "search":
				return (
					<SearchScreen
						themeMode={state.themeMode}
						api={api}
						onBack={backOnStack}
						onOpenTweet={this._openTweet}
						onOpenAuthor={this._openAuthor}
						onReply={this._reply}
						onQuote={this._quote}
					/>
				);
			case "notifications":
				return (
					<NotificationsScreen
						themeMode={state.themeMode}
						api={api}
						onBack={backOnStack}
						onOpenTweet={this._openTweet}
						onOpenAuthor={this._openAuthor}
					/>
				);
			case "messages":
				return (
					<MessagesScreen
						themeMode={state.themeMode}
						api={api}
						currentUser={state.currentUser}
						onBack={backOnStack}
						onOpenConversation={(conversation) => {
							this.navigate("dmConversation", { conversation: conversation });
						}}
					/>
				);
			case "dmConversation":
				return (
					<DMConversationScreen
						themeMode={state.themeMode}
						api={api}
						conversation={params.conversation as DMConversation}
						currentUserId={state.currentUser ? state.currentUser.id : ""}
						onBack={this.goBack}
					/>
				);
			case "profile": {
				const user = (params.user as XUser) || state.currentUser;
				const isSelf = params.user ? Boolean(params.isSelf) : true;
				if (!user) return null;
				return (
					<ProfileScreen
						themeMode={state.themeMode}
						api={api}
						user={user}
						isSelf={isSelf}
						onBack={backOnStack}
						onOpenTweet={this._openTweet}
						onOpenAuthor={this._openAuthor}
						onReply={this._reply}
						onQuote={this._quote}
						onSettings={() => {
							this.navigate("settings", {});
						}}
					/>
				);
			}
			case "tweetDetail":
				return (
					<TweetDetailScreen
						themeMode={state.themeMode}
						api={api}
						tweetId={params.tweetId as string}
						onBack={this.goBack}
						onOpenTweet={this._openTweet}
						onOpenAuthor={this._openAuthor}
						onReply={this._reply}
						onQuote={this._quote}
					/>
				);
			case "compose":
				return (
					<ComposeScreen
						themeMode={state.themeMode}
						api={api}
						currentUser={state.currentUser}
						mode={(params.mode as "tweet" | "reply" | "quote") || "tweet"}
						target={params.target as Tweet | undefined}
						onClose={this.goBack}
						onPosted={this.goBack}
					/>
				);
			case "bookmarks":
				return (
					<BookmarksScreen
						themeMode={state.themeMode}
						api={api}
						onBack={this.goBack}
						onOpenTweet={this._openTweet}
						onOpenAuthor={this._openAuthor}
						onReply={this._reply}
						onQuote={this._quote}
					/>
				);
			case "settings":
				return (
					<SettingsScreen
						themeMode={state.themeMode}
						notifEnabled={state.notifEnabled}
						soundEnabled={state.soundEnabled}
						fontSize={state.fontSize}
						onToggleTheme={this._toggleTheme}
						onToggleNotif={this._toggleNotif}
						onToggleSound={this._toggleSound}
						onChangeFontSize={this._changeFontSize}
						onBookmarks={() => {
							this.navigate("bookmarks", {});
						}}
						onLogout={this.handleLogout}
						onBack={this.goBack}
					/>
				);
			default:
				return null;
		}
	}

	_showTabBar(current: StackEntry): boolean {
		return this.state.stack.length === 1 && TAB_ROOTS.indexOf(current.screen) !== -1;
	}

	render(): React.ReactElement {
		const colors = getColors();
		if (this.state.initializing) {
			return (
				<View style={[styles.splash, { backgroundColor: colors.bgSplash }]}>
					<ActivityIndicator
						size="large"
						color={colors.splash}
					/>
				</View>
			);
		}
		const current = this.state.stack[this.state.stack.length - 1];
		return (
			<View style={[styles.app, { backgroundColor: colors.bg }]}>
				<StatusBar
					backgroundColor={colors.statusBar}
					barStyle={colors.statusBarStyle}
				/>
				<ErrorBoundary scope="App.screen">{this.renderScreen()}</ErrorBoundary>
				{this._showTabBar(current) ? (
					<TabBar
						activeTab={this.state.activeTab}
						unreadNotifications={this.state.unreadNotifications}
						onSelect={this.selectTab}
					/>
				) : null}
			</View>
		);
	}
}
