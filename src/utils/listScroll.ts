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
