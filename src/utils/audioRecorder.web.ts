import { logger } from "./logger";
import type { WebRecordingResult } from "./types";

let _mediaRecorder: MediaRecorder | null = null;
let _chunks: Blob[] = [];
let _startTime: number = 0;

export function startRecording(): Promise<string> {
	return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (
		stream: MediaStream
	): string {
		_chunks = [];
		_mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
		_mediaRecorder.ondataavailable = function (e: BlobEvent) {
			if (e.data.size > 0) _chunks.push(e.data);
		};
		_mediaRecorder.start();
		_startTime = Date.now();
		return "recording";
	});
}

export function stopRecording(): Promise<WebRecordingResult> {
	return new Promise(function (
		resolve: (value: WebRecordingResult) => void,
		reject: (reason: Error) => void
	) {
		if (!_mediaRecorder) {
			reject(new Error("No active recording"));
			return;
		}
		_mediaRecorder.onstop = function () {
			const duration = Math.round((Date.now() - _startTime) / 1000);
			const blob = new Blob(_chunks, { type: "audio/webm" });
			const tracks = _mediaRecorder!.stream.getTracks();
			for (let i = 0; i < tracks.length; i++) tracks[i].stop();
			_mediaRecorder = null;
			_chunks = [];
			resolve({
				blob: blob,
				duration: duration,
				name: "voice_message.webm",
				type: "audio/webm"
			});
		};
		_mediaRecorder.stop();
	});
}

export function cancelRecording(): Promise<void> {
	if (_mediaRecorder) {
		try {
			const tracks = _mediaRecorder.stream.getTracks();
			for (let i = 0; i < tracks.length; i++) tracks[i].stop();
			_mediaRecorder.stop();
		} catch (err: unknown) {
			logger.warn("audioRecorder.cancel", "failed to stop recorder cleanly", err);
		}
		_mediaRecorder = null;
		_chunks = [];
	}
	return Promise.resolve();
}
