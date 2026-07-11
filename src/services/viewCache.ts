// Generic in-memory view cache. Lives at module scope so a screen's loaded data
// (list items, an optional pagination cursor, scroll position) survives unmount:
// navigating away and back — or between tabs — restores the view instantly
// instead of refetching from the top and losing the user's place.
//
// Data-only by design. We keep plain arrays, NOT mounted component trees, so the
// cost is a few KB per view and the JS thread / DOM stay lean — screens still
// unmount normally. Deliberately cheaper than keep-alive on a low-end device (Q20).
//
// One cache serves every list (feeds, notifications, DM inbox, a DM thread); each
// caller supplies its own string key and element type.

export interface ViewCacheEntry<T> {
	data: T[];
	cursor?: string;
	scrollOffset: number;
	fetchedAt: number;
}

// Bound memory: a long session (many profiles, searches, threads) evicts the
// least-recently-used view past this count.
const MAX_ENTRIES = 20;
// Views older than this cold-load on next mount so the user isn't stuck on stale
// data after a long time away.
const TTL_MS = 10 * 60 * 1000;

const store = new Map<string, ViewCacheEntry<unknown>>();

// Returns a fresh entry (marking it most-recently used) or null when absent or
// expired. Callers treat null as "cold load".
export function getView<T>(key: string): ViewCacheEntry<T> | null {
	const entry = store.get(key);
	if (!entry) return null;
	if (Date.now() - entry.fetchedAt > TTL_MS) {
		store.delete(key);
		return null;
	}
	// Re-insert to move to the end (LRU recency).
	store.delete(key);
	store.set(key, entry);
	return entry as ViewCacheEntry<T>;
}

// Record a full load. Resets freshness; preserves scroll offset if the view was
// already on screen (refresh/pagination shouldn't lose the user's position).
export function saveView<T>(key: string, data: T[], cursor?: string): void {
	const prev = store.get(key);
	store.delete(key);
	store.set(key, {
		data: data,
		cursor: cursor,
		scrollOffset: prev ? prev.scrollOffset : 0,
		fetchedAt: Date.now()
	});
	evict();
}

// Optimistic in-place edit (e.g. like/repost swaps a row). Updates the cached
// data without touching freshness, cursor, or scroll.
export function patchView<T>(key: string, data: T[]): void {
	const entry = store.get(key);
	if (entry) entry.data = data;
}

export function setScrollOffset(key: string, offset: number): void {
	const entry = store.get(key);
	if (entry) entry.scrollOffset = offset;
}

// Called on logout / account switch — a new session must not read the previous
// account's views.
export function clearViews(): void {
	store.clear();
}

function evict(): void {
	while (store.size > MAX_ENTRIES) {
		const oldest = store.keys().next().value;
		if (oldest === undefined) break;
		store.delete(oldest);
	}
}
