import type { SoundConstructor, SoundInstance } from "./types";

const Sound: SoundConstructor = require("react-native-sound");
Sound.setCategory("Playback");

let notifSound: SoundInstance | null = null;
let _muted: boolean = false;

export function setNotificationMuted(muted: boolean): void {
	_muted = muted;
}

export function playNotification(): void {
	if (_muted) return;
	try {
		if (!notifSound) {
			notifSound = new Sound("notification.mp3", Sound.MAIN_BUNDLE, function (err: Error | null) {
				if (!err && notifSound) notifSound.play();
			});
		} else {
			notifSound.stop(function () {
				if (notifSound) notifSound.play();
			});
		}
	} catch (e) {
		// Silent fail if sound unavailable
	}
}
