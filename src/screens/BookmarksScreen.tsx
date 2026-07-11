import type XAPI from "../api/xapi";
import { Header } from "../components";
import { TweetList } from "../components/tweet";
import { loadBookmarks } from "../services/timelineLoader";
import { getColors } from "../theme";
import type { ThemeMode } from "../theme";
import type { TimelinePage, Tweet, XUser } from "../types/x";
import React, { Component } from "react";
import { View } from "react-native";

export interface BookmarksProps {
	themeMode: ThemeMode;
	api: XAPI;
	onBack: () => void;
	onOpenTweet: (tweet: Tweet) => void;
	onOpenAuthor: (user: XUser) => void;
	onReply: (tweet: Tweet) => void;
	onQuote: (tweet: Tweet) => void;
}

// Saved posts — the bookmarks timeline over the shared TweetList. Thin, because
// the feed engine and its loader already exist.
export default class BookmarksScreen extends Component<BookmarksProps> {
	constructor(props: BookmarksProps) {
		super(props);
		this._loadPage = this._loadPage.bind(this);
	}

	_loadPage(cursor?: string): Promise<TimelinePage> {
		return loadBookmarks(this.props.api, cursor);
	}

	render(): React.ReactNode {
		const c = getColors();
		return (
			<View style={{ flex: 1, backgroundColor: c.bg }}>
				<Header
					title="Bookmarks"
					onBack={this.props.onBack}
				/>
				<TweetList
					cacheKey="bookmarks"
					api={this.props.api}
					loadPage={this._loadPage}
					onOpenTweet={this.props.onOpenTweet}
					onOpenAuthor={this.props.onOpenAuthor}
					onReply={this.props.onReply}
					onQuote={this.props.onQuote}
					emptyText="You haven't added any posts to your Bookmarks yet."
				/>
			</View>
		);
	}
}
