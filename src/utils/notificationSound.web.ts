let audioCtx: AudioContext | null = null;
let _muted: boolean = false;

function getAudioContext(): AudioContext | null {
	if (!audioCtx) {
		const AC =
			window.AudioContext ||
			((window as unknown as Record<string, unknown>).webkitAudioContext as
				typeof AudioContext | undefined);
		if (AC) audioCtx = new AC();
	}
	return audioCtx;
}

export function setNotificationMuted(muted: boolean): void {
	_muted = muted;
}

export function playNotification(): void {
	if (_muted) return;
	const ctx = getAudioContext();
	if (!ctx) return;

	// Resume if suspended (browsers require user gesture)
	if (ctx.state === "suspended") {
		ctx.resume();
	}

	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.connect(gain);
	gain.connect(ctx.destination);

	osc.type = "sine";
	osc.frequency.setValueAtTime(880, ctx.currentTime);
	osc.frequency.setValueAtTime(660, ctx.currentTime + 0.08);

	gain.gain.setValueAtTime(0.3, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

	osc.start(ctx.currentTime);
	osc.stop(ctx.currentTime + 0.2);
}
