import { NativeModules } from "react-native";

interface MouseControlModule {
	setMouseEnabled(enabled: boolean): void;
}

const KeyEventModule = NativeModules.KeyEventModule as MouseControlModule | undefined;

// Enables/disables the BlackBerry trackpad cursor. Screens that rely on
// hardware D-pad navigation (e.g. Login) disable it to avoid conflicting
// pointer-driven focus. No-op on web (see pointer.web.ts).
export function setMouseEnabled(enabled: boolean): void {
	if (KeyEventModule && KeyEventModule.setMouseEnabled) {
		KeyEventModule.setMouseEnabled(enabled);
	}
}
