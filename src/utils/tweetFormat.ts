// Tweet-specific formatting: X's compact relative timestamps ("2h", "3d",
// "Mar 5") and abbreviated engagement counts ("1.2K", "3.4M"). Pure functions.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "just now" → "45s" → "12m" → "5h" → "Mar 5" → "Mar 5, 2023" (X's rules).
export function relativeTime(createdAtMs: number, nowMs: number): string {
	if (!createdAtMs) return "";
	const diff = nowMs - createdAtMs;
	if (diff < MINUTE) {
		const s = Math.floor(diff / SECOND);
		return s <= 0 ? "now" : s + "s";
	}
	if (diff < HOUR) return Math.floor(diff / MINUTE) + "m";
	if (diff < DAY) return Math.floor(diff / HOUR) + "h";

	const date = new Date(createdAtMs);
	const now = new Date(nowMs);
	const sameYear = date.getFullYear() === now.getFullYear();
	const base = MONTHS[date.getMonth()] + " " + date.getDate();
	return sameYear ? base : base + ", " + date.getFullYear();
}

// Full timestamp for the detail view, e.g. "3:04 PM · Mar 5, 2024".
export function fullTimestamp(createdAtMs: number): string {
	if (!createdAtMs) return "";
	const date = new Date(createdAtMs);
	let hours = date.getHours();
	const mins = date.getMinutes();
	const ampm = hours >= 12 ? "PM" : "AM";
	hours = hours % 12;
	if (hours === 0) hours = 12;
	const m = mins < 10 ? "0" + mins : "" + mins;
	const time = hours + ":" + m + " " + ampm;
	return time + " · " + MONTHS[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
}

// 999 → "999", 1500 → "1.5K", 2_400_000 → "2.4M". Trailing ".0" is dropped.
export function abbreviateCount(count: number): string {
	if (!count || count < 0) return "";
	if (count < 1000) return String(count);
	if (count < 1_000_000) return trimZero(count / 1000) + "K";
	return trimZero(count / 1_000_000) + "M";
}

function trimZero(value: number): string {
	const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
	const str = String(rounded);
	return str.indexOf(".0") !== -1 ? str.replace(".0", "") : str;
}
