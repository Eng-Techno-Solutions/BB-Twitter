// X's GraphQL endpoints (SearchTimeline today, more over time) reject requests
// that lack a valid `x-client-transaction-id` header with a 404. X computes this
// header in its web client from two public inputs — a per-build set of SVG
// "loading" animation frames + byte indices in its ondemand.s bundle, plus a
// rotating verification key on the homepage — hashed per (method, path). This is
// a faithful port of that algorithm (ref: iSarabjitDhiman/XClientTransaction),
// verified live: a generated id turns the SearchTimeline 404 into a 200.
//
// The manager below fetches those public inputs once, caches the built generator,
// and is FAIL-OPEN: if anything goes wrong it returns null and the caller simply
// omits the header — so endpoints that don't yet enforce it keep working.

import { API } from "../utils/constants";
import { request } from "./http";
import { Platform } from "react-native";
import { sha256Bytes, utf8Bytes, base64EncodeBytes, base64DecodeToBytes } from "./crypto";

const IS_WEB = Platform.OS === "web";
const ADDITIONAL_RANDOM_NUMBER = 3;
const DEFAULT_KEYWORD = "obfiowerehiring";
// X's epoch offset for the time component (seconds since 2023-05-01T07:00:00Z).
const X_EPOCH = 1682924400;
const TOTAL_TIME = 4096;
// Rebuild the generator this often; the underlying animation frames only change
// when X ships a new client bundle. A stale build surfaces as a 404, which also
// triggers an immediate invalidate+retry in the caller.
const TTL_MS = 30 * 60 * 1000;

// ---- small math helpers (ported verbatim from the reference) ----
function isOdd(n: number): number {
	return n % 2 ? -1.0 : 0.0;
}

function pyRound(num: number): number {
	const x = Math.floor(num);
	const r = num - x >= 0.5 ? Math.ceil(num) : x;
	return num < 0 ? -Math.abs(r) : Math.abs(r);
}

function round2(v: number): number {
	return Math.round(v * 100) / 100;
}

function floatToHex(x: number): string {
	const result: string[] = [];
	let quotient = Math.trunc(x);
	let fraction = x - quotient;
	while (quotient > 0) {
		quotient = Math.trunc(x / 16);
		const remainder = Math.trunc(x - quotient * 16);
		result.unshift(remainder > 9 ? String.fromCharCode(remainder + 55) : String(remainder));
		x = quotient;
	}
	if (fraction === 0) {
		return result.join("");
	}
	result.push(".");
	while (fraction > 0) {
		fraction *= 16;
		const integer = Math.trunc(fraction);
		fraction -= integer;
		result.push(integer > 9 ? String.fromCharCode(integer + 55) : String(integer));
	}
	return result.join("");
}

function interpolate(fromList: number[], toList: number[], f: number): number[] {
	return fromList.map(function (_, i) {
		return fromList[i] * (1 - f) + toList[i] * f;
	});
}

function rotationToMatrix(rotation: number): number[] {
	const rad = (rotation * Math.PI) / 180;
	return [Math.cos(rad), -Math.sin(rad), Math.sin(rad), Math.cos(rad)];
}

function cubicValue(curves: number[], time: number): number {
	function calc(a: number, b: number, m: number): number {
		return 3.0 * a * (1 - m) * (1 - m) * m + 3.0 * b * (1 - m) * m * m + m * m * m;
	}
	let startGradient = 0, endGradient = 0, start = 0, mid = 0, end = 1;
	if (time <= 0.0) {
		if (curves[0] > 0.0) startGradient = curves[1] / curves[0];
		else if (curves[1] === 0.0 && curves[2] > 0.0) startGradient = curves[3] / curves[2];
		return startGradient * time;
	}
	if (time >= 1.0) {
		if (curves[2] < 1.0) endGradient = (curves[3] - 1.0) / (curves[2] - 1.0);
		else if (curves[2] === 1.0 && curves[0] < 1.0) endGradient = (curves[1] - 1.0) / (curves[0] - 1.0);
		return 1.0 + endGradient * (time - 1.0);
	}
	while (start < end) {
		mid = (start + end) / 2;
		const xEst = calc(curves[0], curves[2], mid);
		if (Math.abs(time - xEst) < 0.00001) return calc(curves[1], curves[3], mid);
		if (xEst < time) start = mid;
		else end = mid;
	}
	return calc(curves[1], curves[3], mid);
}

// ---- generator: pure, deterministic given the fetched build inputs ----
class ClientTransaction {
	rowIndex: number;
	keyBytesIndices: number[];
	key: string;
	keyBytes: number[];
	animationKey: string;

	constructor(homeHtml: string, ondemandText: string) {
		const indices = getIndices(ondemandText);
		this.rowIndex = indices[0];
		this.keyBytesIndices = indices[1];
		this.key = getKey(homeHtml);
		this.keyBytes = base64DecodeToBytes(this.key);
		this.animationKey = this.getAnimationKey(homeHtml);
	}

	getAnimationKey(html: string): string {
		const rowIndex = this.keyBytes[this.rowIndex] % 16;
		let frameTime = this.keyBytesIndices.reduce((acc, idx) => acc * (this.keyBytes[idx] % 16), 1);
		frameTime = pyRound(frameTime / 10) * 10;
		const frameRow = get2dArray(this.keyBytes, html)[rowIndex];
		return this.animate(frameRow, frameTime / TOTAL_TIME);
	}

	animate(frames: number[], targetTime: number): string {
		const fromColor = [frames[0], frames[1], frames[2], 1].map(Number);
		const toColor = [frames[3], frames[4], frames[5], 1].map(Number);
		const toRotation = [solve(Number(frames[6]), 60.0, 360.0, true)];
		const rest = frames.slice(7);
		const curves = rest.map((item, counter) => solve(Number(item), isOdd(counter), 1.0, false));
		const val = cubicValue(curves, targetTime);
		const color = interpolate(fromColor, toColor, val).map((v) => Math.max(0, Math.min(255, v)));
		const rotation = interpolate([0.0], toRotation, val);
		const matrix = rotationToMatrix(rotation[0]);
		const strArr = color.slice(0, -1).map((v) => pyRound(v).toString(16));
		for (const value of matrix) {
			let rounded = round2(value);
			if (rounded < 0) rounded = -rounded;
			const hexValue = floatToHex(rounded);
			strArr.push(hexValue.startsWith(".") ? ("0" + hexValue).toLowerCase() : hexValue ? hexValue : "0");
		}
		strArr.push("0", "0");
		return strArr.join("").replace(/[.-]/g, "");
	}

	generate(method: string, path: string): string {
		const timeNow = Math.floor((Date.now() - X_EPOCH * 1000) / 1000);
		const timeBytes = [0, 1, 2, 3].map((i) => (timeNow >> (i * 8)) & 0xff);
		const hashStr = method + "!" + path + "!" + timeNow + DEFAULT_KEYWORD + this.animationKey;
		const hashBytes = Array.from(sha256Bytes(utf8Bytes(hashStr)));
		const randomNum = Math.floor(Math.random() * 256);
		const bytesArr = [
			...this.keyBytes,
			...timeBytes,
			...hashBytes.slice(0, 16),
			ADDITIONAL_RANDOM_NUMBER
		];
		const out = [randomNum, ...bytesArr.map((b) => b ^ randomNum)];
		return base64EncodeBytes(out).replace(/=+$/, "");
	}
}

function solve(value: number, minVal: number, maxVal: number, rounding: boolean): number {
	const result = (value * (maxVal - minVal)) / 255 + minVal;
	return rounding ? Math.floor(result) : round2(result);
}

function getIndices(ondemand: string): [number, number[]] {
	const re = /(\(\w\[(\d{1,2})\],\s*16\))+/gm;
	const out: number[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(ondemand)) !== null) {
		out.push(parseInt(m[2], 10));
		if (m.index === re.lastIndex) re.lastIndex++;
	}
	if (!out.length) throw new Error("no key-byte indices");
	return [out[0], out.slice(1)];
}

function getKey(html: string): string {
	const m =
		html.match(/<meta[^>]*name=["']twitter-site-verification["'][^>]*content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter-site-verification["']/i);
	if (!m) throw new Error("no twitter-site-verification key");
	return m[1];
}

function getFrameDs(html: string): string[] {
	const ds: string[] = [];
	const svgRe = /<svg[^>]*id=["']loading-x-anim-\d["'][\s\S]*?<\/svg>/gi;
	let s: RegExpExecArray | null;
	while ((s = svgRe.exec(html)) !== null) {
		const paths = [...s[0].matchAll(/<path[^>]*\sd=["']([^"']+)["']/gi)];
		if (paths.length >= 2) ds.push(paths[1][1]);
		else if (paths.length) ds.push(paths[paths.length - 1][1]);
	}
	return ds;
}

function get2dArray(keyBytes: number[], html: string): number[][] {
	const ds = getFrameDs(html);
	const d = ds[keyBytes[5] % 4];
	return d
		.slice(9)
		.split("C")
		.map((item) =>
			item
				.replace(/[^\d]+/g, " ")
				.trim()
				.split(/\s+/)
				.filter((x) => x.length)
				.map((x) => parseInt(x, 10))
		);
}

// ---- cached, fail-open manager ----
let cache: { ct: ClientTransaction; at: number } | null = null;
let inflight: Promise<ClientTransaction | null> | null = null;

function ondemandUrl(html: string): string {
	const idxMatch = html.match(/,(\d+):["']ondemand\.s["']/);
	if (!idxMatch) return null;
	const hashMatch = html.match(new RegExp(",\\s*" + idxMatch[1] + ':\\s*"([0-9a-f]+)"'));
	if (!hashMatch) return null;
	const base = IS_WEB ? API.ABS_PROXY : API.ABS_WEB;
	return base + "/responsive-web/client-web/ondemand.s." + hashMatch[1] + "a.js";
}

async function build(): Promise<ClientTransaction | null> {
	const homeUrl = IS_WEB ? API.HOME_PROXY : API.HOME_WEB;
	const home = await request("GET", homeUrl, {}, "");
	if (home.status >= 400 || !home.body) return null;
	const odUrl = ondemandUrl(home.body);
	if (!odUrl) return null;
	const od = await request("GET", odUrl, {}, "");
	if (od.status >= 400 || !od.body) return null;
	return new ClientTransaction(home.body, od.body);
}

async function ensure(): Promise<ClientTransaction | null> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.ct;
	if (inflight) return inflight;
	inflight = build()
		.then((ct) => {
			if (ct) cache = { ct: ct, at: Date.now() };
			inflight = null;
			return ct;
		})
		.catch((): ClientTransaction | null => {
			inflight = null;
			return null;
		});
	return inflight;
}

// Returns a valid x-client-transaction-id for (method, path), or null on any
// failure — callers omit the header when null. `path` is the real x.com path
// (e.g. /i/api/graphql/<queryId>/<Op>), NOT the dev-proxy path.
export async function getTransactionId(method: string, path: string): Promise<string | null> {
	try {
		const ct = await ensure();
		return ct ? ct.generate(method, path) : null;
	} catch (_e) {
		return null;
	}
}

// Drop the cached build so the next call refetches — invoked when a request that
// carried a transaction id still 404s (i.e. X rotated its client bundle).
export function invalidateTransaction(): void {
	cache = null;
}
