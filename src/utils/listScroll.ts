type ScrollParams = {
	index: number;
	viewOffset?: number;
	animated?: boolean;
};

type ScrollableList = {
	scrollToIndex: (params: ScrollParams) => void;
};

// FlatList.scrollToIndex throws when the target index isn't yet measured
// (off-screen, before layout). The scroll is best-effort UI sugar, so we
// intentionally swallow that error rather than crash navigation.
export function safeScrollToIndex(list: ScrollableList | null, index: number): void {
	if (!list) return;
	try {
		list.scrollToIndex({ index: index, viewOffset: 80, animated: true });
	} catch (_err) {
		// Index not measured yet — intentional no-op.
	}
}

type OffsetScrollableList = {
	scrollToOffset: (params: { offset: number; animated: boolean }) => void;
};

// How far one Q20 trackpad ("BB touch mouse") up/down key event nudges the list.
// The trackpad emits a burst of events per swipe, so a modest step accumulates
// into a smooth scroll.
export const KEY_SCROLL_STEP = 120;

// The trackpad delivers D-pad "up"/"down" key events (see keyEvents.ts), but a
// FlatList only scrolls from touch drags — so lists translate those key events
// into explicit scrollToOffset calls. Returns the new offset so the caller can
// keep its tracked value in sync; no-op (returns currentOffset) for other keys.
export function scrollListByKey(
	list: OffsetScrollableList | null,
	currentOffset: number,
	action: string,
	step: number = KEY_SCROLL_STEP
): number {
	if (action !== "up" && action !== "down") return currentOffset;
	const delta = action === "down" ? step : -step;
	const next = Math.max(0, currentOffset + delta);
	if (list) list.scrollToOffset({ offset: next, animated: false });
	return next;
}
