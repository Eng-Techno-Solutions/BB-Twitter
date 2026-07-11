import type { KeyEventCallback } from "../types/events";
import { DeviceEventEmitter, Platform } from "react-native";
import type { EmitterSubscription } from "react-native";

const listeners: EmitterSubscription[] = [];

function addKeyEventListener(
	callback: KeyEventCallback
): EmitterSubscription | { remove: () => void } {
	if (Platform.OS !== "android") return { remove: function () {} };
	const sub = DeviceEventEmitter.addListener("onKeyEvent", callback);
	listeners.push(sub);
	return sub;
}

function removeKeyEventListener(sub: { remove: () => void } | null): void {
	if (sub && sub.remove) sub.remove();
	const idx = listeners.indexOf(sub as EmitterSubscription);
	if (idx !== -1) listeners.splice(idx, 1);
}

export { addKeyEventListener, removeKeyEventListener };
