import { styles } from "./src/App.styles";
import XAPI from "./src/api/xapi";
import { ErrorBoundary, TabBar } from "./src/components";
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
} from "./src/screens";
import {
	authenticate,
	getResetState,
	persistAccountLogin,
	removeAccount,
	tryAutoLogin,
	upsertAccount
} from "./src/services/accountManager";
import {
	startBackgroundNotifications,
	stopBackgroundNotifications,
	syncAccountsToNative,
	syncMentionsOnlyToNative
} from "./src/services/nativeNotification";
import { loadUnreadCount } from "./src/services/notificationsService";
import type { HomeTab } from "./src/services/timelineLoader";
import { clearViews } from "./src/services/viewCache";
import { getColors, setFontSizeKey, setMode } from "./src/theme";
import type { FontSizeKey } from "./src/theme";
import type { AppProps as Props, StackEntry, AppState as State, TabKey } from "./src/types/app";
import type { DMConversation, Tweet, XUser } from "./src/types/x";
import { clearToken, logger } from "./src/utils";
import { errorMessage } from "./src/utils/error";
import {
	getFontSize,
	getMentionsOnly,
	getNotifEnabled,
	getSoundEnabled,
	getTheme,
	saveFontSize,
	saveMentionsOnly,
	saveNotifEnabled,
	saveSoundEnabled,
	saveTheme
} from "./src/utils/storage";
import type { XSession } from "./src/utils/storage";
import React, { Component } from "react";
import { ActivityIndicator, AppState, BackHandler, StatusBar, View } from "react-native";
import type { AppStateStatus, NativeEventSubscription } from "react-native";

const TAB_SCREEN: Record<TabKey, string> = {
	home: "home",
	search: "search",
	notifications: "notifications",
	messages: "messages",
	profile: "profile"
};
const TAB_ROOTS = ["home", "search", "notifications", "messages", "profile"];

// Android entry. Identical navigation/state to src/App.tsx (kept in sync per the
// dual-entry rule), plus the native hardware-Back handling the Q20 needs.
export default class App extends Component<Props, State> {
	_backHandler: NativeEventSubscription | null;
	_badgeTimer: ReturnType<typeof setInterval> | null;
	_appStateListener: NativeEventSubscription | null;

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
			mentionsOnly: false,
			soundEnabled: true,
			fontSize: "medium",
			unreadNotifications: 0,
			scrollTopSignal: 0
		};
		this._backHandler = null;
		this._badgeTimer = null;
		this._appStateListener = null;
	}

	componentDidMount(): void {
		this._initTheme();
		this._initSettings();
		this._autoLogin();
		const self = this;
		this._backHandler = BackHandler.addEventListener("hardwareBackPress", function () {
			return self._onHardwareBack();
		});
		// The in-app badge poller is foreground-only (like BBSlack's JS poller);
		// the native service owns the background path, so pause the timer when
		// backgrounded and resume on return.
		this._appStateListener = AppState.addEventListener("change", function (status: AppStateStatus) {
			self._handleAppState(status);
		});
	}

	componentWillUnmount(): void {
		if (this._backHandler) this._backHandler.remove();
		if (this._appStateListener) this._appStateListener.remove();
		this._stopBadgePolling();
	}

	// Native background polling is driven by setAccounts + the notif toggle, NOT
	// by AppState (matching BBSlack) — so swipe-kill from recents still leaves the
	// service armed. AppState only gates the foreground JS badge poller.
	_handleAppState(status: AppStateStatus): void {
		if (status === "active") {
			if (this.state.api) this._startBadgePolling(this.state.api);
		} else if (status === "background") {
			this._stopBadgePolling();
		}
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

	// Hardware Back: pop the stack if we can; if we're on a non-home tab root,
	// fall back to Home; otherwise let the OS background the app.
	_onHardwareBack(): boolean {
		if (this.state.stack.length > 1) {
			this.goBack();
			return true;
		}
		if (this.state.api && this.state.activeTab !== "home") {
			this.selectTab("home");
			return true;
		}
		return false;
	}

	// ── Theme & settings ───────────────────────────────────
	async _initTheme(): Promise<void> {
		try {
			const mode = await getTheme();
			setMode(mode);
			this.setState({ themeMode: mode });
		} catch (err: unknown) {
			logger.warn("App.initTheme", "failed to load theme", err);
		}
	}

	async _initSettings(): Promise<void> {
		try {
			const notifEnabled = await getNotifEnabled();
			const mentionsOnly = await getMentionsOnly();
			const soundEnabled = await getSoundEnabled();
			const fontSize = await getFontSize();
			setFontSizeKey(fontSize);
			// Re-sync the mentions-only pref to native every launch so it survives
			// a reinstall, and stop the native service if the user disabled
			// notifications (setAccounts auto-arms it on login).
			syncMentionsOnlyToNative(mentionsOnly);
			if (!notifEnabled) stopBackgroundNotifications();
			this.setState({
				notifEnabled: notifEnabled,
				mentionsOnly: mentionsOnly,
				soundEnabled: soundEnabled,
				fontSize: fontSize
			});
		} catch (err: unknown) {
			logger.warn("App.initSettings", "failed to load settings", err);
		}
	}

	_toggleTheme = (): void => {
		const mode = this.state.themeMode === "dark" ? "light" : "dark";
		setMode(mode);
		this.setState({ themeMode: mode });
		saveTheme(mode);
	};

	_toggleNotif = (): void => {
		const enabled = !this.state.notifEnabled;
		this.setState({ notifEnabled: enabled });
		saveNotifEnabled(enabled);
		if (enabled) {
			if (this.state.accounts.length > 0) startBackgroundNotifications();
		} else {
			stopBackgroundNotifications();
		}
	};

	_toggleMentionsOnly = (): void => {
		const enabled = !this.state.mentionsOnly;
		this.setState({ mentionsOnly: enabled });
		saveMentionsOnly(enabled);
		syncMentionsOnlyToNative(enabled);
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
		// Hand the updated account list to the native poll service (which starts
		// the background service when the list is non-empty). Gated by the notif
		// toggle so a disabled user doesn't get polled.
		if (this.state.notifEnabled) syncAccountsToNative(accounts);
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
		// Re-sync remaining accounts; an empty list stops the native service.
		syncAccountsToNative(accounts);
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
		// Re-tapping the tab you're already on (at its root) scrolls the feed to the
		// top instead of doing nothing — bump the signal the active feed watches.
		const isAtRoot = this.state.activeTab === tab && this.state.stack.length === 1;
		this.setState({
			activeTab: tab,
			stack: [{ screen: TAB_SCREEN[tab], params: {} }],
			unreadNotifications: unread,
			scrollTopSignal: isAtRoot ? this.state.scrollTopSignal + 1 : this.state.scrollTopSignal
		});
	};

	// ── Shared tweet handlers ──────────────────────────────
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
						scrollTopSignal={state.scrollTopSignal}
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
						scrollTopSignal={state.scrollTopSignal}
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
						scrollTopSignal={state.scrollTopSignal}
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
						scrollTopSignal={state.scrollTopSignal}
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
						scrollTopSignal={state.scrollTopSignal}
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
						mentionsOnly={state.mentionsOnly}
						soundEnabled={state.soundEnabled}
						fontSize={state.fontSize}
						onToggleTheme={this._toggleTheme}
						onToggleNotif={this._toggleNotif}
						onToggleMentionsOnly={this._toggleMentionsOnly}
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
