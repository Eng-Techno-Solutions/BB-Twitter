#!/usr/bin/env node
// Guards against RN 0.53's silent-empty-bundle footgun: when the bundler
// fails to resolve the entry or hits a syntax it can't transform, it writes
// a minimal (~16 KB) polyfill-only bundle with no user code AND exits 0.
// The release APK then crashes on the device with "App has stopped" and no
// useful error. Fail the build instead.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const APK = path.join(
	__dirname,
	"..",
	"android",
	"app",
	"build",
	"outputs",
	"apk",
	"release",
	"app-release.apk"
);
const MIN_BUNDLE_BYTES = 100 * 1024;

if (!fs.existsSync(APK)) {
	console.error("verify-release-bundle: APK not found at " + APK);
	process.exit(1);
}

let listing;
try {
	listing = execSync("unzip -l " + JSON.stringify(APK), { encoding: "utf8" });
} catch (err) {
	console.error("verify-release-bundle: failed to read APK: " + err.message);
	process.exit(1);
}

const match = listing
	.split("\n")
	.map(function (line) {
		return line.trim();
	})
	.find(function (line) {
		return line.endsWith("assets/index.android.bundle");
	});

if (!match) {
	console.error("verify-release-bundle: assets/index.android.bundle missing from APK");
	process.exit(1);
}

const bytes = parseInt(match.split(/\s+/)[0], 10);
if (!Number.isFinite(bytes) || bytes < MIN_BUNDLE_BYTES) {
	console.error(
		"verify-release-bundle: bundle is suspiciously small (" +
			bytes +
			" bytes, threshold " +
			MIN_BUNDLE_BYTES +
			"). The bundler likely failed silently — check rn-cli.config.js, the entry file, and recent JS syntax (e.g. catch{} requires ES2019)."
	);
	process.exit(1);
}

console.log("verify-release-bundle: ok (" + bytes + " bytes)");
