import { request } from "../api/http";
import { API, X_WEB_BEARER } from "../utils/constants";
import { clearCookies, readCookies } from "../utils/cookies";
import type { XSession } from "../utils/storage";
import { Platform } from "react-native";

/* eslint-disable @typescript-eslint/no-explicit-any */

// X username/password login. There is no simple token endpoint — login is a
// multi-step "onboarding flow" state machine (guest token → flow init → JS
// instrumentation → username → password → account-dup check → success). The
// ct0/auth_token cookies land via Set-Cookie across the flow and are read from
// the native cookie jar (utils/cookies) at the end.
//
// This path is inherently fragile: X frequently injects captcha / suspicious-login
// (LoginAcid) / 2FA subtasks. We handle 2FA + Acid by surfacing a code prompt;
// anything else (e.g. Arkose captcha) dead-ends with a message telling the user to
// use the paste-session method instead. Android-only (needs the native cookie jar).

const IS_WEB = Platform.OS === "web";
const V11_BASE = IS_WEB ? API.V11_PROXY : API.V11_WEB;

// Subtask versions X's web client currently sends. If the flow starts failing at
// init with a version error, refresh these the same way as GraphQL query ids.
const SUBTASK_VERSIONS = {
	action_list: 2,
	alert_dialog: 1,
	app_download_cta: 1,
	check_logged_in_account: 1,
	choice_selection: 3,
	contacts_live_sync_permission_prompt: 0,
	cta: 7,
	email_verification: 2,
	end_flow: 1,
	enter_date: 1,
	enter_email: 2,
	enter_password: 5,
	enter_phone: 2,
	enter_recaptcha: 1,
	enter_text: 5,
	enter_username: 2,
	generic_urt: 3,
	in_app_notification: 1,
	interest_picker: 3,
	js_instrumentation: 1,
	menu_dialog: 1,
	notifications_permission_prompt: 2,
	open_account: 2,
	open_home_timeline: 1,
	open_link: 1,
	phone_verification: 4,
	privacy_options: 1,
	security_key: 3,
	select_avatar: 4,
	select_banner: 2,
	settings_list: 7,
	show_code: 1,
	sign_up: 2,
	sign_up_review: 4,
	tweet_selection_urt: 1,
	update_users: 1,
	upload_media: 1,
	user_recommendations_list: 4,
	user_recommendations_urt: 1,
	wait_spinner: 3,
	web_modal: 1
};

export type LoginStatus = "success" | "pin" | "acid" | "error";

// Opaque cursor the UI carries between beginLogin() and submitCode().
export interface LoginFlowState {
	guestToken: string;
	flowToken: string;
	subtaskId: string;
}

export interface LoginResult {
	status: LoginStatus;
	session?: XSession;
	flow?: LoginFlowState;
	message?: string;
}

function jsonHeaders(guestToken: string, ct0: string): Record<string, string> {
	const headers: Record<string, string> = {
		Authorization: X_WEB_BEARER,
		"Content-Type": "application/json",
		"x-guest-token": guestToken,
		"x-twitter-active-user": "yes",
		"x-twitter-client-language": "en"
	};
	if (ct0) headers["x-csrf-token"] = ct0;
	return headers;
}

async function fetchGuestToken(): Promise<string> {
	const res = await request(
		"POST",
		V11_BASE + "guest/activate.json",
		{ Authorization: X_WEB_BEARER, "Content-Type": "application/json" },
		""
	);
	const data = JSON.parse(res.body);
	if (!data.guest_token) throw new Error("Could not start login (no guest token).");
	return data.guest_token as string;
}

async function postTask(guestToken: string, query: string, body: any): Promise<any> {
	const cookies = await readCookies();
	const ct0 = cookies.ct0 || "";
	const res = await request(
		"POST",
		V11_BASE + "onboarding/task.json" + query,
		jsonHeaders(guestToken, ct0),
		JSON.stringify(body)
	);
	if (res.status >= 400) {
		const errMsg = safeError(res.body);
		throw new Error(errMsg || "Login failed (HTTP " + res.status + ").");
	}
	return JSON.parse(res.body);
}

function safeError(body: string): string {
	try {
		const data = JSON.parse(body);
		if (data.errors && data.errors[0] && data.errors[0].message) return data.errors[0].message;
	} catch (_e) {
		// fall through
	}
	return "";
}

function findSubtask(subtasks: any[], id: string): any {
	return (subtasks || []).find(function (s: any) {
		return s.subtask_id === id;
	});
}

function subtaskIds(subtasks: any[]): string[] {
	return (subtasks || []).map(function (s: any) {
		return s.subtask_id;
	});
}

// Reads the session out of the native cookie jar after LoginSuccess.
async function sessionFromCookies(): Promise<XSession | null> {
	const cookies = await readCookies();
	if (cookies.auth_token && cookies.ct0) {
		return { authToken: cookies.auth_token, csrf: cookies.ct0 };
	}
	return null;
}

// Given the current subtask list, either finish (success) or surface the next
// challenge the UI must handle.
async function resolve(
	guestToken: string,
	flowToken: string,
	subtasks: any[]
): Promise<LoginResult> {
	const ids = subtaskIds(subtasks);

	if (ids.indexOf("LoginSuccessSubtask") !== -1 || ids.indexOf("LoginOpenHomeTimeline") !== -1) {
		const session = await sessionFromCookies();
		if (session) return { status: "success", session: session };
		return { status: "error", message: "Signed in but couldn't read the session cookies." };
	}

	if (ids.indexOf("LoginTwoFactorAuthChallenge") !== -1) {
		return {
			status: "pin",
			flow: { guestToken, flowToken, subtaskId: "LoginTwoFactorAuthChallenge" }
		};
	}
	if (ids.indexOf("LoginAcid") !== -1) {
		return { status: "acid", flow: { guestToken, flowToken, subtaskId: "LoginAcid" } };
	}
	if (ids.indexOf("DenyLoginSubtask") !== -1) {
		return { status: "error", message: "X denied this login. Use the paste-session method." };
	}
	// Arkose captcha or any unhandled subtask.
	if (ids.indexOf("ArkoseLogin") !== -1 || ids.length > 0) {
		return {
			status: "error",
			message: "X requires a verification step this app can't complete. Use the paste-session method."
		};
	}
	// No subtasks and no success marker — try cookies anyway.
	const session = await sessionFromCookies();
	if (session) return { status: "success", session: session };
	return { status: "error", message: "Login did not complete. Use the paste-session method." };
}

// Runs guest→init→instrumentation→username→password→dup-check, then resolves.
export async function beginLogin(username: string, password: string): Promise<LoginResult> {
	await clearCookies();
	const guestToken = await fetchGuestToken();

	let data = await postTask(guestToken, "?flow_name=login", {
		input_flow_data: {
			flow_context: { debug_overrides: {}, start_location: { location: "splash_screen" } }
		},
		subtask_versions: SUBTASK_VERSIONS
	});
	let flowToken: string = data.flow_token;
	let subtasks: any[] = data.subtasks || [];

	// A small driver: submit whichever known subtask is next until we reach a
	// terminal state (success / challenge / error). Bounded to avoid loops.
	for (let step = 0; step < 8; step++) {
		if (findSubtask(subtasks, "LoginJsInstrumentationSubtask")) {
			data = await postTask(guestToken, "", {
				flow_token: flowToken,
				subtask_inputs: [
					{
						subtask_id: "LoginJsInstrumentationSubtask",
						js_instrumentation: { response: "{}", link: "next_link" }
					}
				]
			});
		} else if (findSubtask(subtasks, "LoginEnterUserIdentifierSSO")) {
			data = await postTask(guestToken, "", {
				flow_token: flowToken,
				subtask_inputs: [
					{
						subtask_id: "LoginEnterUserIdentifierSSO",
						settings_list: {
							setting_responses: [
								{
									key: "user_identifier",
									response_data: { text_data: { result: username } }
								}
							],
							link: "next_link"
						}
					}
				]
			});
		} else if (findSubtask(subtasks, "LoginEnterPassword")) {
			data = await postTask(guestToken, "", {
				flow_token: flowToken,
				subtask_inputs: [
					{
						subtask_id: "LoginEnterPassword",
						enter_password: { password: password, link: "next_link" }
					}
				]
			});
		} else if (findSubtask(subtasks, "AccountDuplicationCheck")) {
			data = await postTask(guestToken, "", {
				flow_token: flowToken,
				subtask_inputs: [
					{
						subtask_id: "AccountDuplicationCheck",
						check_logged_in_account: { link: "AccountDuplicationCheck_false" }
					}
				]
			});
		} else {
			// Nothing left we auto-handle — hand off to resolve() (success/challenge).
			return resolve(guestToken, flowToken, subtasks);
		}

		flowToken = data.flow_token || flowToken;
		subtasks = data.subtasks || [];
		// Early-out if a terminal/challenge subtask has appeared.
		const nextIds = subtaskIds(subtasks);
		if (
			nextIds.indexOf("LoginSuccessSubtask") !== -1 ||
			nextIds.indexOf("LoginTwoFactorAuthChallenge") !== -1 ||
			nextIds.indexOf("LoginAcid") !== -1 ||
			nextIds.indexOf("DenyLoginSubtask") !== -1
		) {
			return resolve(guestToken, flowToken, subtasks);
		}
	}
	return resolve(guestToken, flowToken, subtasks);
}

// Submits a 2FA / email confirmation code for the challenge beginLogin surfaced.
export async function submitCode(flow: LoginFlowState, code: string): Promise<LoginResult> {
	const data = await postTask(flow.guestToken, "", {
		flow_token: flow.flowToken,
		subtask_inputs: [
			{
				subtask_id: flow.subtaskId,
				enter_text: { text: code, link: "next_link" }
			}
		]
	});
	return resolve(flow.guestToken, data.flow_token || flow.flowToken, data.subtasks || []);
}
