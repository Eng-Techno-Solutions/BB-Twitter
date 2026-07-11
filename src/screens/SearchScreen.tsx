import type XAPI from "../api/xapi";
import { TweetList } from "../components/tweet";
import Icon from "../components/ui/Icon";
import { loadSearch } from "../services/timelineLoader";
import type { SearchProduct } from "../services/timelineLoader";
import { getColors } from "../theme";
import type { ThemeMode } from "../theme";
import type { TimelinePage, Tweet, XUser } from "../types/x";
import React, { Component } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

export interface SearchProps {
	themeMode: ThemeMode;
	api: XAPI;
	onBack: (() => void) | null;
	onOpenTweet: (tweet: Tweet) => void;
	onOpenAuthor: (user: XUser) => void;
	onReply: (tweet: Tweet) => void;
}

interface SearchState {
	input: string;
	query: string; // committed query that drives the results feed
	product: SearchProduct;
}

const PRODUCTS: SearchProduct[] = ["Top", "Latest", "Media"];

// Explore/Search: a query box plus a Top/Latest/Media filter strip over the
// shared TweetList. The committed query + product form the feed's remount key, so
// a new search or filter reloads results without bespoke list code.
export default class SearchScreen extends Component<SearchProps, SearchState> {
	constructor(props: SearchProps) {
		super(props);
		this.state = { input: "", query: "", product: "Top" };
		this._loadPage = this._loadPage.bind(this);
	}

	_submit(): void {
		const q = this.state.input.trim();
		if (q) this.setState({ query: q });
	}

	_loadPage(cursor?: string): Promise<TimelinePage> {
		return loadSearch(this.props.api, this.state.query, this.state.product, cursor);
	}

	render(): React.ReactNode {
		const c = getColors();
		const self = this;
		const { input, query, product } = this.state;

		return (
			<View style={{ flex: 1, backgroundColor: c.bg }}>
				<View style={[styles.searchBar, { backgroundColor: c.bgHeader, borderBottomColor: c.border }]}>
					<View
						style={[styles.inputWrap, { backgroundColor: c.bgTertiary, borderColor: c.borderInput }]}>
						<Icon
							name="search"
							size={16}
							color={c.textTertiary}
						/>
						<TextInput
							style={[styles.input, { color: c.textPrimary }]}
							placeholder="Search X"
							placeholderTextColor={c.textPlaceholder}
							value={input}
							onChangeText={function (t: string) {
								self.setState({ input: t });
							}}
							onSubmitEditing={function () {
								self._submit();
							}}
							returnKeyType="search"
							autoCapitalize="none"
							autoCorrect={false}
							data-type="input"
						/>
						{input ? (
							<TouchableOpacity
								onPress={function () {
									self.setState({ input: "", query: "" });
								}}
								data-type="icon-btn">
								<Icon
									name="close"
									size={16}
									color={c.textTertiary}
								/>
							</TouchableOpacity>
						) : null}
					</View>
				</View>

				{query ? (
					<View style={[styles.filterStrip, { borderBottomColor: c.border }]}>
						{PRODUCTS.map(function (p: SearchProduct) {
							const active = p === product;
							return (
								<TouchableOpacity
									key={p}
									style={styles.filter}
									onPress={function () {
										self.setState({ product: p });
									}}
									data-type="filter-btn">
									<Text style={[styles.filterText, { color: active ? c.textPrimary : c.tabText }]}>{p}</Text>
									{active ? <View style={[styles.filterUnderline, { backgroundColor: c.accent }]} /> : null}
								</TouchableOpacity>
							);
						})}
					</View>
				) : null}

				{query ? (
					<TweetList
						key={query + ":" + product}
						api={this.props.api}
						loadPage={this._loadPage}
						onOpenTweet={this.props.onOpenTweet}
						onOpenAuthor={this.props.onOpenAuthor}
						onReply={this.props.onReply}
						emptyText="No results."
					/>
				) : (
					<View style={styles.hint}>
						<Text style={[styles.hintText, { color: c.textTertiary }]}>
							Search for people, posts, and topics.
						</Text>
					</View>
				)}
			</View>
		);
	}
}

const styles = StyleSheet.create<{
	searchBar: ViewStyle;
	inputWrap: ViewStyle;
	input: TextStyle;
	filterStrip: ViewStyle;
	filter: ViewStyle;
	filterText: TextStyle;
	filterUnderline: ViewStyle;
	hint: ViewStyle;
	hintText: TextStyle;
}>({
	searchBar: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderBottomWidth: StyleSheet.hairlineWidth
	},
	inputWrap: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: 20,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 12,
		height: 38
	},
	input: { flex: 1, fontSize: 15, marginLeft: 8, paddingVertical: 0 },
	filterStrip: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
	filter: { flex: 1, alignItems: "center", paddingVertical: 11 },
	filterText: { fontSize: 14, fontWeight: "600" },
	filterUnderline: { height: 3, width: 40, borderRadius: 2, marginTop: 6 },
	hint: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
	hintText: { fontSize: 15, textAlign: "center" }
});
