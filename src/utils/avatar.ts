// Deterministic fallback-avatar color for a user id (when no profile image).
const AVATAR_COLORS: string[] = [
	"#1D9BF0",
	"#00BA7C",
	"#F91880",
	"#7856FF",
	"#FF7A00",
	"#FFD400",
	"#E0245E",
	"#17BF63",
	"#794BC4",
	"#1ABC9C",
	"#E74C3C",
	"#3498DB"
];

function hashCode(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash = hash & hash;
	}
	return Math.abs(hash);
}

export function getAvatarColor(userId: string): string {
	return AVATAR_COLORS[hashCode(userId || "") % AVATAR_COLORS.length];
}
