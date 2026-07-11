import { setScrollOffset } from "../services/viewCache";

// The only capability this helper needs from a list ref. Typing to this instead
// of FlatList<T> keeps it item-type-agnostic and avoids TS widening the ref to
// FlatList<unknown> at call sites (FlatList is invariant in its item type).
interface Scrollable {
	scrollToOffset(params: { offset: number; animated?: boolean }): void;
}

// Re-tapping the active bottom tab scrolls its feed to the top (the X/BB10
// behavior). App bumps a monotonically increasing signal; each tab list compares
// the previous vs next signal in componentDidUpdate and, on change, animates its
// FlatList back to offset 0 and clears the cached scroll position so navigating
// away/back doesn't restore the old (scrolled-down) offset.
export function handleScrollTopSignal(
	prevSignal: number | undefined,
	nextSignal: number | undefined,
	list: Scrollable | null,
	cacheKey?: string
): void {
	if (prevSignal === nextSignal) return;
	if (list) list.scrollToOffset({ offset: 0, animated: true });
	if (cacheKey) setScrollOffset(cacheKey, 0);
}
