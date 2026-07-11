import { logger } from "../../utils";
import ErrorView from "./ErrorView";
import React, { Component } from "react";

type Props = {
	scope: string;
	children: React.ReactNode;
	onReset?: () => void;
};

type State = {
	hasError: boolean;
	message: string;
};

export default class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, message: "" };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, message: error.message || "Something went wrong" };
	}

	componentDidCatch(error: Error): void {
		logger.error(this.props.scope, "render crash", error);
	}

	_handleRetry = (): void => {
		this.setState({ hasError: false, message: "" });
		if (this.props.onReset) this.props.onReset();
	};

	render(): React.ReactNode {
		if (!this.state.hasError) return this.props.children;
		return (
			<ErrorView
				message={this.state.message}
				onRetry={this._handleRetry}
			/>
		);
	}
}
