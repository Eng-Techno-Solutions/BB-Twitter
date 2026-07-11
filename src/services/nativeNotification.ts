import type { XAccount } from "../types/app";
import { NativeModules, Platform } from "react-native";

// Bridge to the native Android background poll service (NotificationModule.java /
// NotificationPollService.java). Direct port of BBSlack's nativeNotification.ts:
// the JS side only syncs accounts + toggles the service; all polling, diffing,
// and OS-notification posting happen natively so they survive the app being
// swiped from recents. Every call is a no-op off Android.

interface NativeNotificationModule {
	setAccounts(accountsJson: string): void;
	startBackgroundPolling(): void;
	stopBackgroundPolling(): void;
	setChannelsMentionOnly(enabled: boolean): void;
	sendTestNotification(): void;
	getDiagnostics(): Promise<string>;
}

const NotifModule = NativeModules.NotificationModule as NativeNotificationModule | undefined;

export interface NotifDiagnostics {
	serviceStartedAt: number;
	now: number;
	lastPoll: {
		at?: number;
		foreground?: boolean;
		accounts?: number;
		results?: string[];
	};
}

// Hands the native service the current account list. Native ties the poll
// service's lifetime to this: a non-empty array starts it (covering the
// swipe-kill login case), "[]" stops it. Each entry carries the session pair
// (authToken + ct0) the poller needs to authenticate.
export function syncAccountsToNative(accounts: XAccount[]): void {
	if (Platform.OS !== "android" || !NotifModule) return;
	NotifModule.setAccounts(JSON.stringify(accounts));
}

export function startBackgroundNotifications(): void {
	if (Platform.OS !== "android" || !NotifModule) return;
	NotifModule.startBackgroundPolling();
}

export function stopBackgroundNotifications(): void {
	if (Platform.OS !== "android" || !NotifModule) return;
	NotifModule.stopBackgroundPolling();
}

// When enabled, the feed poll only posts for @mentions and replies; DMs always
// post on any new message.
export function syncMentionsOnlyToNative(enabled: boolean): void {
	if (Platform.OS !== "android" || !NotifModule) return;
	NotifModule.setChannelsMentionOnly(enabled);
}

export function hasNotifDiagnostics(): boolean {
	return Platform.OS === "android" && !!NotifModule;
}

export function sendTestNotification(): void {
	if (!hasNotifDiagnostics()) return;
	NotifModule!.sendTestNotification();
}

// The poll service's self-reported last-run status, surfaced in Settings because
// the BB10 device can't be attached to adb in the field.
export async function getNotifDiagnostics(): Promise<NotifDiagnostics | null> {
	if (!hasNotifDiagnostics()) return null;
	try {
		const raw = await NotifModule!.getDiagnostics();
		return JSON.parse(raw) as NotifDiagnostics;
	} catch (_e) {
		return null;
	}
}
