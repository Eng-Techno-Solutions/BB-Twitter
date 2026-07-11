import { parseNotifications } from "../api/parseNotifications";
import type XAPI from "../api/xapi";
import type { NotificationsPage } from "../types/x";

// Data-access seam for the notifications feed (mentions/likes/follows). Keeps the
// v2 notifications shape out of the screen, mirroring timelineLoader's role.
export async function loadNotifications(api: XAPI, cursor?: string): Promise<NotificationsPage> {
	const response = await api.notifications(cursor);
	return parseNotifications(response);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// Cheap unread count for the tab badge. Returns 0 on any failure — a badge is not
// worth surfacing an error for.
export async function loadUnreadCount(api: XAPI): Promise<number> {
	try {
		const data: any = await api.badgeCount();
		let n: any;
		if (data) n = data.ntab_unread_count != null ? data.ntab_unread_count : data.unread_count;
		return typeof n === "number" ? n : 0;
	} catch (_err) {
		return 0;
	}
}
