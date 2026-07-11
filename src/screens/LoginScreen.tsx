import { Icon } from "../components";
import { parseSessionInput } from "../services/authService";
import { beginLogin, submitCode } from "../services/loginFlow";
import type { LoginFlowState } from "../services/loginFlow";
import { getColors } from "../theme";
import type { ThemeMode } from "../theme";
import type { KeyEvent, KeySub } from "../types/events";
import { cookieJarAvailable } from "../utils/cookies";
import { errorMessage } from "../utils/error";
import { addKeyEventListener, removeKeyEventListener } from "../utils/keyEvents";
import { setMouseEnabled } from "../utils/pointer";
import type { XSession } from "../utils/storage";
import { styles } from "./LoginScreen.styles";
import React, { Component } from "react";
import {
	ActivityIndicator,
	Linking,
	ScrollView,
	Text,
	TextInput,
	TouchableHighlight,
	View
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

const X_LOGIN_URL = "https://x.com/login";

export interface LoginProps {
	themeMode: ThemeMode;
	onLogin: (session: XSession) => Promise<void>;
	onBack: (() => void) | null;
}

type LoginMode = "session" | "password";

interface LoginState {
	mode: LoginMode;
	// Session (paste) fields
	authToken: string;
	csrf: string;
	// Password flow fields
	username: string;
	password: string;
	code: string;
	needsCode: boolean;
	flow: LoginFlowState | null;
	// Shared
	loading: boolean;
	error: string | null;
	notice: string | null;
	focusIndex: number;
}

type FieldName =
	| "sessionTab"
	| "passwordTab"
	| "authToken"
	| "csrf"
	| "sessionSignin"
	| "openX"
	| "username"
	| "password"
	| "passwordSignin"
	| "code"
	| "verify"
	| "codeBack";

interface FocusableRef {
	focus?: () => void;
	measure?: (
		cb: (fx: number, fy: number, w: number, h: number, px: number, py: number) => void
	) => void;
}

// Two login methods, mirroring BBSlack's Email/Token tabs:
//  • Session — paste auth_token + ct0 (reliable, works everywhere).
//  • Password — X's internal login flow (username/password + 2FA). Android-only
//    (needs the native cookie jar) and can dead-end on captcha, so Session stays
//    the fallback. Same hardware-D-pad-only interaction as BBSlack's LoginScreen.
export default class LoginScreen extends Component<LoginProps, LoginState> {
	_keySub: KeySub | null;
	_inputRefs: Record<string, FocusableRef | null>;
	_scrollView: ScrollView | null;
	_scrollY: number;

	constructor(props: LoginProps) {
		super(props);
		this.state = {
			mode: "session",
			authToken: "",
			csrf: "",
			username: "",
			password: "",
			code: "",
			needsCode: false,
			flow: null,
			loading: false,
			error: null,
			notice: null,
			focusIndex: -1
		};
		this._keySub = null;
		this._inputRefs = {};
		this._scrollView = null;
		this._scrollY = 0;
	}

	componentDidMount(): void {
		const self = this;
		this._keySub = addKeyEventListener(function (e: KeyEvent) {
			self._handleKeyEvent(e);
		});
		setMouseEnabled(false);
	}

	componentWillUnmount(): void {
		removeKeyEventListener(this._keySub);
		setMouseEnabled(true);
	}

	_getFields(): FieldName[] {
		if (this.state.mode === "session") {
			return ["sessionTab", "passwordTab", "authToken", "csrf", "sessionSignin", "openX"];
		}
		if (this.state.needsCode) {
			return ["code", "verify", "codeBack"];
		}
		return ["sessionTab", "passwordTab", "username", "password", "passwordSignin"];
	}

	_handleKeyEvent(e: KeyEvent): void {
		const fields = this._getFields();
		const idx = this.state.focusIndex;
		if (e.action === "down") {
			const next = Math.min(idx + 1, fields.length - 1);
			this.setState({ focusIndex: next });
			this._focusField(fields[next]);
			this._scrollToField(fields[next]);
		} else if (e.action === "up") {
			const prev = Math.max(idx - 1, 0);
			this.setState({ focusIndex: prev });
			this._focusField(fields[prev]);
			this._scrollToField(fields[prev]);
		} else if (e.action === "select" && idx >= 0 && idx < fields.length) {
			this._activateField(fields[idx]);
		}
	}

	_focusField(field: FieldName): void {
		const ref = this._inputRefs[field];
		if (ref && ref.focus) ref.focus();
	}

	_scrollToField(field: FieldName): void {
		const ref = this._inputRefs[field];
		if (!ref || !ref.measure || !this._scrollView) return;
		const sv = this._scrollView;
		const scrollY = this._scrollY;
		ref.measure(function (fx: number, fy: number, w: number, h: number, px: number, py: number) {
			if (py === undefined) return;
			sv.scrollTo({ y: Math.max(0, scrollY + py - 120), animated: true });
		});
	}

	_activateField(field: FieldName): void {
		if (field === "sessionTab")
			this.setState({ mode: "session", error: null, notice: null, focusIndex: 0 });
		else if (field === "passwordTab") this._selectPassword();
		else if (field === "sessionSignin") this.handleSessionLogin();
		else if (field === "passwordSignin") this.handlePasswordLogin();
		else if (field === "verify") this.handleCodeSubmit();
		else if (field === "codeBack")
			this.setState({ needsCode: false, code: "", flow: null, error: null, focusIndex: -1 });
		else if (field === "openX") Linking.openURL(X_LOGIN_URL);
	}

	_selectPassword(): void {
		const notice = cookieJarAvailable()
			? null
			: "Password login needs the device build. On web, use Session.";
		this.setState({ mode: "password", error: null, notice: notice, focusIndex: 0 });
	}

	async handleSessionLogin(): Promise<void> {
		const session = parseSessionInput(this.state.authToken, this.state.csrf);
		if (!session) {
			this.setState({ error: "Enter both your auth_token and ct0 values." });
			return;
		}
		this.setState({ loading: true, error: null });
		try {
			await this.props.onLogin(session);
		} catch (err: unknown) {
			this.setState({ loading: false, error: errorMessage(err, "Sign in failed") });
		}
	}

	async handlePasswordLogin(): Promise<void> {
		const username = this.state.username.trim();
		const password = this.state.password;
		if (!username || !password) {
			this.setState({ error: "Enter your username/email and password." });
			return;
		}
		this.setState({ loading: true, error: null, notice: null });
		try {
			const result = await beginLogin(username, password);
			if (result.status === "success" && result.session) {
				await this.props.onLogin(result.session);
			} else if (result.status === "pin" || result.status === "acid") {
				this.setState({
					loading: false,
					needsCode: true,
					flow: result.flow || null,
					focusIndex: -1,
					notice:
						result.status === "acid"
							? "Enter the confirmation code X sent to your email or phone."
							: "Enter your two-factor authentication code."
				});
			} else {
				this.setState({ loading: false, error: result.message || "Login failed." });
			}
		} catch (err: unknown) {
			this.setState({ loading: false, error: errorMessage(err, "Login failed") });
		}
	}

	async handleCodeSubmit(): Promise<void> {
		const code = this.state.code.trim();
		if (!code || !this.state.flow) return;
		this.setState({ loading: true, error: null });
		try {
			const result = await submitCode(this.state.flow, code);
			if (result.status === "success" && result.session) {
				await this.props.onLogin(result.session);
			} else {
				this.setState({ loading: false, error: result.message || "That code didn't work." });
			}
		} catch (err: unknown) {
			this.setState({ loading: false, error: errorMessage(err, "Verification failed") });
		}
	}

	_inputStyle(field: FieldName, c: ReturnType<typeof getColors>): object {
		const fields = this._getFields();
		return {
			backgroundColor: c.bgTertiary,
			color: c.textSecondary,
			borderColor: this.state.focusIndex === fields.indexOf(field) ? c.accent : c.borderInput
		};
	}

	_setRef(name: FieldName): (r: FocusableRef | null) => void {
		const self = this;
		return function (r: FocusableRef | null) {
			self._inputRefs[name] = r;
		};
	}

	_renderTabs(c: ReturnType<typeof getColors>): React.ReactNode {
		const self = this;
		const { mode } = this.state;
		const fields = this._getFields();
		return (
			<View style={styles.tabs}>
				<TouchableHighlight
					ref={this._setRef("sessionTab")}
					style={[
						styles.tab,
						{ borderColor: c.border },
						mode === "session" && { backgroundColor: c.accent, borderColor: c.accent },
						this.state.focusIndex === fields.indexOf("sessionTab") && {
							borderColor: c.accent,
							borderWidth: 2
						}
					]}
					underlayColor={c.accent}
					onPress={function () {
						self.setState({ mode: "session", error: null, notice: null });
					}}
					data-type="btn">
					<Text style={[styles.tabText, { color: mode === "session" ? "#ffffff" : c.textSecondary }]}>
						Session
					</Text>
				</TouchableHighlight>
				<TouchableHighlight
					ref={this._setRef("passwordTab")}
					style={[
						styles.tab,
						{ borderColor: c.border },
						mode === "password" && { backgroundColor: c.accent, borderColor: c.accent },
						this.state.focusIndex === fields.indexOf("passwordTab") && {
							borderColor: c.accent,
							borderWidth: 2
						}
					]}
					underlayColor={c.accent}
					onPress={function () {
						self._selectPassword();
					}}
					data-type="btn">
					<Text style={[styles.tabText, { color: mode === "password" ? "#ffffff" : c.textSecondary }]}>
						Password
					</Text>
				</TouchableHighlight>
			</View>
		);
	}

	_renderSession(c: ReturnType<typeof getColors>): React.ReactNode {
		const self = this;
		const { authToken, csrf, loading, focusIndex } = this.state;
		const fields = this._getFields();
		const canSubmit = authToken.trim().length > 0 && csrf.trim().length > 0;
		return (
			<View style={styles.form}>
				<Text style={[styles.label, { color: c.textSecondary }]}>auth_token cookie</Text>
				<TextInput
					ref={this._setRef("authToken")}
					style={[styles.input, this._inputStyle("authToken", c)]}
					placeholder="auth_token value"
					placeholderTextColor={c.textPlaceholder}
					value={authToken}
					onChangeText={function (t: string) {
						self.setState({ authToken: t });
					}}
					autoCapitalize="none"
					autoCorrect={false}
					secureTextEntry={true}
					data-type="input"
				/>
				<Text style={[styles.label, { color: c.textSecondary }]}>ct0 cookie (CSRF)</Text>
				<TextInput
					ref={this._setRef("csrf")}
					style={[styles.input, this._inputStyle("csrf", c)]}
					placeholder="ct0 value"
					placeholderTextColor={c.textPlaceholder}
					value={csrf}
					onChangeText={function (t: string) {
						self.setState({ csrf: t });
					}}
					autoCapitalize="none"
					autoCorrect={false}
					onSubmitEditing={function () {
						self.handleSessionLogin();
					}}
					data-type="input"
				/>
				<TouchableHighlight
					ref={this._setRef("sessionSignin")}
					style={[
						styles.button,
						{ backgroundColor: c.accent },
						!canSubmit && styles.buttonDisabled,
						focusIndex === fields.indexOf("sessionSignin") && styles.buttonFocused
					]}
					underlayColor="#1A8CD8"
					onPress={function () {
						self.handleSessionLogin();
					}}
					disabled={loading || !canSubmit}
					data-type="btn">
					{loading ? (
						<ActivityIndicator
							size="small"
							color="#ffffff"
						/>
					) : (
						<Text style={styles.buttonText}>Sign In</Text>
					)}
				</TouchableHighlight>

				<View style={[styles.instructions, { borderColor: c.border }]}>
					<Text style={[styles.instructionsTitle, { color: c.textSecondary }]}>
						How to get your session:
					</Text>
					<Text style={[styles.step, { color: c.textTertiary }]}>1. Log in to x.com in a browser</Text>
					<Text style={[styles.step, { color: c.textTertiary }]}>
						2. DevTools → Application → Cookies → x.com
					</Text>
					<Text style={[styles.step, { color: c.textTertiary }]}>3. Copy auth_token and ct0 values</Text>
					<TouchableHighlight
						ref={this._setRef("openX")}
						style={[
							styles.linkButton,
							{ borderColor: c.accent },
							focusIndex === fields.indexOf("openX") && { borderColor: c.accent, borderWidth: 2 }
						]}
						underlayColor={c.bgTertiary}
						onPress={function () {
							Linking.openURL(X_LOGIN_URL);
						}}
						data-type="btn">
						<Text style={[styles.linkButtonText, { color: c.accent }]}>Open x.com</Text>
					</TouchableHighlight>
				</View>
			</View>
		);
	}

	_renderPassword(c: ReturnType<typeof getColors>): React.ReactNode {
		const self = this;
		const { username, password, loading, focusIndex } = this.state;
		const fields = this._getFields();
		const canSubmit = username.trim().length > 0 && password.length > 0;
		return (
			<View style={styles.form}>
				<Text style={[styles.label, { color: c.textSecondary }]}>Username or email</Text>
				<TextInput
					ref={this._setRef("username")}
					style={[styles.input, this._inputStyle("username", c)]}
					placeholder="@handle or email"
					placeholderTextColor={c.textPlaceholder}
					value={username}
					onChangeText={function (t: string) {
						self.setState({ username: t });
					}}
					autoCapitalize="none"
					autoCorrect={false}
					data-type="input"
				/>
				<Text style={[styles.label, { color: c.textSecondary }]}>Password</Text>
				<TextInput
					ref={this._setRef("password")}
					style={[styles.input, this._inputStyle("password", c)]}
					placeholder="Password"
					placeholderTextColor={c.textPlaceholder}
					value={password}
					onChangeText={function (t: string) {
						self.setState({ password: t });
					}}
					secureTextEntry={true}
					onSubmitEditing={function () {
						self.handlePasswordLogin();
					}}
					data-type="input"
				/>
				<TouchableHighlight
					ref={this._setRef("passwordSignin")}
					style={[
						styles.button,
						{ backgroundColor: c.accent },
						!canSubmit && styles.buttonDisabled,
						focusIndex === fields.indexOf("passwordSignin") && styles.buttonFocused
					]}
					underlayColor="#1A8CD8"
					onPress={function () {
						self.handlePasswordLogin();
					}}
					disabled={loading || !canSubmit}
					data-type="btn">
					{loading ? (
						<ActivityIndicator
							size="small"
							color="#ffffff"
						/>
					) : (
						<Text style={styles.buttonText}>Sign In</Text>
					)}
				</TouchableHighlight>
				<Text style={[styles.hint, { color: c.textTertiary, marginTop: 12 }]}>
					If X asks for a captcha or blocks the sign-in, use the Session method instead.
				</Text>
			</View>
		);
	}

	_renderCode(c: ReturnType<typeof getColors>): React.ReactNode {
		const self = this;
		const { code, loading, focusIndex } = this.state;
		const fields = this._getFields();
		return (
			<View style={styles.form}>
				<Text style={[styles.label, { color: c.textSecondary }]}>Verification code</Text>
				<TextInput
					ref={this._setRef("code")}
					style={[
						styles.input,
						this._inputStyle("code", c),
						{ textAlign: "center", fontSize: 20, letterSpacing: 6 }
					]}
					placeholder="000000"
					placeholderTextColor={c.textPlaceholder}
					value={code}
					onChangeText={function (t: string) {
						self.setState({ code: t.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8) });
					}}
					keyboardType="numeric"
					onSubmitEditing={function () {
						self.handleCodeSubmit();
					}}
					data-type="input"
				/>
				<TouchableHighlight
					ref={this._setRef("verify")}
					style={[
						styles.button,
						{ backgroundColor: c.accent },
						code.trim().length === 0 && styles.buttonDisabled,
						focusIndex === fields.indexOf("verify") && styles.buttonFocused
					]}
					underlayColor="#1A8CD8"
					onPress={function () {
						self.handleCodeSubmit();
					}}
					disabled={loading || code.trim().length === 0}
					data-type="btn">
					{loading ? (
						<ActivityIndicator
							size="small"
							color="#ffffff"
						/>
					) : (
						<Text style={styles.buttonText}>Verify</Text>
					)}
				</TouchableHighlight>
				<TouchableHighlight
					ref={this._setRef("codeBack")}
					style={[
						styles.linkButton,
						{ borderColor: c.border, marginTop: 12 },
						focusIndex === fields.indexOf("codeBack") && { borderColor: c.accent }
					]}
					underlayColor={c.bgTertiary}
					onPress={function () {
						self.setState({ needsCode: false, code: "", flow: null, error: null });
					}}
					data-type="btn">
					<Text style={[styles.linkButtonText, { color: c.textSecondary }]}>Back</Text>
				</TouchableHighlight>
			</View>
		);
	}

	render(): React.ReactElement {
		const self = this;
		const c = getColors();
		const { mode, needsCode, error, notice } = this.state;

		return (
			<ScrollView
				ref={function (r: ScrollView | null) {
					self._scrollView = r;
				}}
				style={{ flex: 1, backgroundColor: c.bg }}
				contentContainerStyle={styles.container}
				keyboardShouldPersistTaps="handled"
				onScroll={function (e: NativeSyntheticEvent<NativeScrollEvent>) {
					self._scrollY = e.nativeEvent.contentOffset.y;
				}}
				scrollEventThrottle={16}>
				{this.props.onBack ? (
					<TouchableHighlight
						style={styles.backBtn}
						underlayColor={c.listUnderlay}
						onPress={this.props.onBack}
						data-type="icon-btn">
						<View style={styles.backBtnInner}>
							<Icon
								name="chevron-left"
								size={20}
								color={c.textTertiary}
							/>
							<Text style={[styles.backBtnText, { color: c.textTertiary }]}>Back</Text>
						</View>
					</TouchableHighlight>
				) : null}

				<Text style={[styles.logo, { color: c.textPrimary }]}>BB Twitter</Text>
				<Text style={[styles.subtitle, { color: c.textTertiary }]}>X client for BlackBerry</Text>

				{needsCode ? null : this._renderTabs(c)}

				{notice ? (
					<Text style={[styles.hint, { color: c.accent, textAlign: "center" }]}>{notice}</Text>
				) : null}

				{needsCode
					? this._renderCode(c)
					: mode === "session"
						? this._renderSession(c)
						: this._renderPassword(c)}

				{error ? <Text style={styles.error}>{error}</Text> : null}

				<Text style={[styles.footer, { color: c.textPlaceholder }]}>
					Your credentials are sent directly to X and stored locally on this device only.
				</Text>
			</ScrollView>
		);
	}
}
