package com.engtechnos.BBTwitter;

import android.media.MediaRecorder;
import android.util.Base64;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;

public class AudioRecorderModule extends ReactContextBaseJavaModule {

    private MediaRecorder mRecorder;
    private String mFilePath;
    private long mStartTime;

    public AudioRecorderModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "AudioRecorderModule";
    }

    @ReactMethod
    public void startRecording(Promise promise) {
        try {
            if (mRecorder != null) {
                try { mRecorder.stop(); } catch (Exception ignored) {}
                mRecorder.release();
                mRecorder = null;
            }

            File dir = getReactApplicationContext().getCacheDir();
            mFilePath = new File(dir, "voice_" + System.currentTimeMillis() + ".m4a").getAbsolutePath();

            mRecorder = new MediaRecorder();
            mRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mRecorder.setAudioSamplingRate(44100);
            mRecorder.setAudioEncodingBitRate(128000);
            mRecorder.setOutputFile(mFilePath);

            mRecorder.prepare();
            mRecorder.start();
            mStartTime = System.currentTimeMillis();

            promise.resolve("recording");
        } catch (Exception e) {
            promise.reject("RECORD_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopRecording(Promise promise) {
        if (mRecorder == null) {
            promise.reject("NO_RECORDER", "No active recording");
            return;
        }

        try {
            long duration = (System.currentTimeMillis() - mStartTime) / 1000;
            mRecorder.stop();
            mRecorder.release();
            mRecorder = null;

            File file = new File(mFilePath);
            FileInputStream fis = new FileInputStream(file);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int len;
            while ((len = fis.read(buffer)) != -1) {
                baos.write(buffer, 0, len);
            }
            fis.close();
            byte[] bytes = baos.toByteArray();
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

            file.delete();

            org.json.JSONObject result = new org.json.JSONObject();
            result.put("base64", base64);
            result.put("duration", duration);
            result.put("name", "voice_message.m4a");
            result.put("type", "audio/mp4");

            promise.resolve(result.toString());
        } catch (Exception e) {
            promise.reject("RECORD_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void cancelRecording(Promise promise) {
        if (mRecorder != null) {
            try { mRecorder.stop(); } catch (Exception ignored) {}
            mRecorder.release();
            mRecorder = null;
        }
        if (mFilePath != null) {
            new File(mFilePath).delete();
            mFilePath = null;
        }
        promise.resolve("cancelled");
    }
}
