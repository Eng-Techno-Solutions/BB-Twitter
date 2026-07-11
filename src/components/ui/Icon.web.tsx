import type { IconProps } from "./types";
import React from "react";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import BarChart2 from "lucide-react/dist/esm/icons/bar-chart-2";
import Bell from "lucide-react/dist/esm/icons/bell";
import Bookmark from "lucide-react/dist/esm/icons/bookmark";
import Camera from "lucide-react/dist/esm/icons/camera";
import Check from "lucide-react/dist/esm/icons/check";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Coffee from "lucide-react/dist/esm/icons/coffee";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Eye from "lucide-react/dist/esm/icons/eye";
import Globe from "lucide-react/dist/esm/icons/globe";
import Hash from "lucide-react/dist/esm/icons/hash";
import Heart from "lucide-react/dist/esm/icons/heart";
import Home from "lucide-react/dist/esm/icons/home";
import ImageIcon from "lucide-react/dist/esm/icons/image";
import Info from "lucide-react/dist/esm/icons/info";
import Lock from "lucide-react/dist/esm/icons/lock";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import Mail from "lucide-react/dist/esm/icons/mail";
import Menu from "lucide-react/dist/esm/icons/menu";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Mic from "lucide-react/dist/esm/icons/mic";
import Moon from "lucide-react/dist/esm/icons/moon";
import MoreHorizontal from "lucide-react/dist/esm/icons/more-horizontal";
import Paperclip from "lucide-react/dist/esm/icons/paperclip";
import Pause from "lucide-react/dist/esm/icons/pause";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Play from "lucide-react/dist/esm/icons/play";
import Plus from "lucide-react/dist/esm/icons/plus";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Repeat from "lucide-react/dist/esm/icons/repeat";
import Reply from "lucide-react/dist/esm/icons/reply";
import Search from "lucide-react/dist/esm/icons/search";
import SendHorizontal from "lucide-react/dist/esm/icons/send-horizontal";
import Settings from "lucide-react/dist/esm/icons/settings";
import Share from "lucide-react/dist/esm/icons/share";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import Smile from "lucide-react/dist/esm/icons/smile";
import Square from "lucide-react/dist/esm/icons/square";
import Sun from "lucide-react/dist/esm/icons/sun";
import ThumbsUp from "lucide-react/dist/esm/icons/thumbs-up";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import User from "lucide-react/dist/esm/icons/user";
import UserCheck from "lucide-react/dist/esm/icons/user-check";
import UserPlus from "lucide-react/dist/esm/icons/user-plus";
import X from "lucide-react/dist/esm/icons/x";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const ICON_MAP: Record<string, LucideIcon> = {
	"chevron-down": ChevronDown,
	"chevron-left": ChevronLeft,
	"chevron-right": ChevronRight,
	close: X,
	lock: Lock,
	search: Search,
	send: SendHorizontal,
	hash: Hash,
	info: Info,
	"log-out": LogOut,
	"message-square": MessageSquare,
	reply: Reply,
	"thumbs-up": ThumbsUp,
	heart: Heart,
	eye: Eye,
	check: Check,
	edit: Pencil,
	trash: Trash2,
	play: Play,
	pause: Pause,
	smile: Smile,
	sun: Sun,
	moon: Moon,
	paperclip: Paperclip,
	mic: Mic,
	square: Square,
	settings: Settings,
	bell: Bell,
	"refresh-cw": RefreshCw,
	globe: Globe,
	user: User,
	coffee: Coffee,
	smartphone: Smartphone,
	"external-link": ExternalLink,
	menu: Menu,
	plus: Plus,
	x: X,
	// X (Twitter) actions and tabs
	"message-circle": MessageCircle,
	repeat: Repeat,
	bookmark: Bookmark,
	share: Share,
	"more-horizontal": MoreHorizontal,
	"arrow-left": ArrowLeft,
	home: Home,
	mail: Mail,
	"bar-chart": BarChart2,
	image: ImageIcon,
	camera: Camera,
	"user-plus": UserPlus,
	"user-check": UserCheck,
	"badge-check": CheckCircle
};

function Icon({ name, size, color }: IconProps): React.ReactElement | null {
	const s = size || 20;
	const c = color || "#D1D2D3";
	const IconComponent = ICON_MAP[name];

	if (!IconComponent) return null;

	return (
		<IconComponent
			size={s}
			color={c}
			strokeWidth={2}
		/>
	);
}

export default Icon;
