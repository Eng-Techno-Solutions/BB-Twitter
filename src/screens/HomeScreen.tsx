import type XAPI from "../api/xapi";
import { Icon } from "../components";
import { TweetList } from "../components/tweet";
import type { HomeTab } from "../services/timelineLoader";
import { loadHome } from "../services/timelineLoader";
import { getColors } from "../theme";
import type { ThemeMode } from "../theme";
import type { TimelinePage, Tweet, XUser } from "../types/x";
import { styles } from "./HomeScreen.styles";
import React, { Component } from "react";
import { Text, TouchableHighlight, TouchableOpacity, View } from "react-native";

export interface HomeProps {
	themeMode: ThemeMode;
	api: XAPI;
	initialTab: HomeTab;
	onOpenTweet: (tweet: Tweet) => void;
	onOpenAuthor: (user: XUser) => void;
	onReply: (tweet: Tweet) => void;
	onQuote: (tweet: Tweet) => void;
	onCompose: () => void;
	onTabChange: (tab: HomeTab) => void;
}

interface HomeState {
	tab: HomeTab;
}

const TABS: Array<{ key: HomeTab; label: string }> = [
	{ key: "forYou", label: "For you" },
	{ key: "following", label: "Following" }
];

// The home feed: a For-you / Following tab strip (BB10 tab pattern) over the
// shared TweetList. Switching tab remounts the list (keyed by tab) so it reloads
// the right timeline — the screen itself stays thin, delegating the feed to
// TweetList and each engagement to the engagement service.
export default class HomeScreen extends Component<HomeProps, HomeState> {
	constructor(props: HomeProps) {
		super(props);
		this.state = { tab: props.initialTab || "forYou" };
		this._loadPage = this._loadPage.bind(this);
	}

	_selectTab(tab: HomeTab): void {
		if (tab === this.state.tab) return;
		this.setState({ tab: tab });
		this.props.onTabChange(tab);
	}

	_loadPage(cursor?: string): Promise<TimelinePage> {
		return loadHome(this.props.api, this.state.tab, cursor);
	}

	render(): React.ReactNode {
		const c = getColors();
		const self = this;
		const { tab } = this.state;

		return (
			<View style={[styles.container, { backgroundColor: c.bg }]}>
				<View style={[styles.tabStrip, { backgroundColor: c.bgHeader, borderBottomColor: c.border }]}>
					{TABS.map(function (t: { key: HomeTab; label: string }) {
						const active = t.key === tab;
						return (
							<TouchableHighlight
								key={t.key}
								style={styles.tab}
								underlayColor={c.messageUnderlay}
								onPress={function () {
									self._selectTab(t.key);
								}}
								data-type="home-tab">
								<View>
									<Text style={[styles.tabLabel, { color: active ? c.textPrimary : c.tabText }]}>
										{t.label}
									</Text>
									{active ? (
										<View style={[styles.tabUnderline, { backgroundColor: c.accent, alignSelf: "center" }]} />
									) : null}
								</View>
							</TouchableHighlight>
						);
					})}
				</View>

				<TweetList
					key={tab}
					cacheKey={"home:" + tab}
					api={this.props.api}
					loadPage={this._loadPage}
					onOpenTweet={this.props.onOpenTweet}
					onOpenAuthor={this.props.onOpenAuthor}
					onReply={this.props.onReply}
					onQuote={this.props.onQuote}
					emptyText={
						tab === "following"
							? "Follow some accounts to see their posts here."
							: "No posts yet. Pull to refresh."
					}
				/>

				<TouchableOpacity
					style={[styles.fab, { backgroundColor: c.accent }]}
					onPress={this.props.onCompose}
					activeOpacity={0.85}
					data-type="fab">
					<Icon
						name="plus"
						size={26}
						color="#FFFFFF"
					/>
				</TouchableOpacity>
			</View>
		);
	}
}
