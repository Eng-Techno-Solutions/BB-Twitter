package com.engtechnos.BBTwitter;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

import java.io.BufferedReader;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLSocketFactory;

import org.json.JSONObject;

public class HttpModule extends ReactContextBaseJavaModule {

    // Reuse worker threads across requests instead of spawning (and tearing
    // down) a fresh OS thread per call. Cached pool keeps idle threads for 60s
    // and grows only under real concurrency, which is low for this app.
    private static final ExecutorService EXECUTOR = Executors.newCachedThreadPool();

    public HttpModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "HttpModule";
    }

    private static SSLSocketFactory createTls12SocketFactory() {
        return Tls12SocketFactory.create();
    }

    @ReactMethod
    public void request(final String method, final String urlString, final String headersJson, final String body, final Promise promise) {
        EXECUTOR.execute(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL(urlString);
                    conn = (HttpURLConnection) url.openConnection();
                    if (conn instanceof HttpsURLConnection) {
                        SSLSocketFactory factory = createTls12SocketFactory();
                        if (factory != null) {
                            ((HttpsURLConnection) conn).setSSLSocketFactory(factory);
                        }
                    }
                    conn.setRequestMethod(method);
                    conn.setConnectTimeout(30000);
                    conn.setReadTimeout(30000);
                    conn.setInstanceFollowRedirects(true);

                    if (headersJson != null && headersJson.length() > 2) {
                        JSONObject headers = new JSONObject(headersJson);
                        Iterator<String> keys = headers.keys();
                        while (keys.hasNext()) {
                            String key = keys.next();
                            conn.setRequestProperty(key, headers.getString(key));
                        }
                    }

                    if (body != null && body.length() > 0 && !method.equals("GET")) {
                        conn.setDoOutput(true);
                        OutputStream os = conn.getOutputStream();
                        os.write(body.getBytes("UTF-8"));
                        os.flush();
                        os.close();
                    }

                    int code = conn.getResponseCode();

                    BufferedReader reader;
                    if (code >= 200 && code < 400) {
                        reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                    } else {
                        reader = new BufferedReader(new InputStreamReader(conn.getErrorStream(), "UTF-8"));
                    }

                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONObject result = new JSONObject();
                    result.put("status", code);
                    result.put("body", sb.toString());
                    promise.resolve(result.toString());
                } catch (Exception e) {
                    String msg = e.getClass().getName() + ": " + e.getMessage();
                    if (e.getCause() != null) {
                        msg += " | Cause: " + e.getCause().getClass().getName() + ": " + e.getCause().getMessage();
                    }
                    promise.reject("NETWORK_ERROR", msg);
                } finally {
                    if (conn != null) {
                        conn.disconnect();
                    }
                }
            }
        });
    }

    @ReactMethod
    public void get(final String urlString, final Promise promise) {
        request("GET", urlString, "{}", "", promise);
    }

    @ReactMethod
    public void uploadMultipart(final String urlString, final String token, final String fieldsJson, final String fileName, final String fileType, final String fileBase64, final Promise promise) {
        EXECUTOR.execute(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    String boundary = "----BBUpload" + System.currentTimeMillis();
                    URL url = new URL(urlString);
                    conn = (HttpURLConnection) url.openConnection();
                    if (conn instanceof HttpsURLConnection) {
                        SSLSocketFactory factory = createTls12SocketFactory();
                        if (factory != null) {
                            ((HttpsURLConnection) conn).setSSLSocketFactory(factory);
                        }
                    }
                    conn.setRequestMethod("POST");
                    conn.setConnectTimeout(60000);
                    conn.setReadTimeout(60000);
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                    conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

                    OutputStream os = conn.getOutputStream();
                    String crlf = "\r\n";

                    // Write text fields
                    if (fieldsJson != null && fieldsJson.length() > 2) {
                        JSONObject fields = new JSONObject(fieldsJson);
                        Iterator<String> keys = fields.keys();
                        while (keys.hasNext()) {
                            String key = keys.next();
                            String val = fields.getString(key);
                            os.write(("--" + boundary + crlf).getBytes("UTF-8"));
                            os.write(("Content-Disposition: form-data; name=\"" + key + "\"" + crlf).getBytes("UTF-8"));
                            os.write((crlf).getBytes("UTF-8"));
                            os.write(val.getBytes("UTF-8"));
                            os.write(crlf.getBytes("UTF-8"));
                        }
                    }

                    // Write file field
                    byte[] fileBytes = android.util.Base64.decode(fileBase64, android.util.Base64.DEFAULT);
                    os.write(("--" + boundary + crlf).getBytes("UTF-8"));
                    os.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + fileName + "\"" + crlf).getBytes("UTF-8"));
                    os.write(("Content-Type: " + fileType + crlf).getBytes("UTF-8"));
                    os.write((crlf).getBytes("UTF-8"));
                    os.write(fileBytes);
                    os.write(crlf.getBytes("UTF-8"));

                    // End boundary
                    os.write(("--" + boundary + "--" + crlf).getBytes("UTF-8"));
                    os.flush();
                    os.close();

                    int code = conn.getResponseCode();
                    BufferedReader reader;
                    if (code >= 200 && code < 400) {
                        reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                    } else {
                        reader = new BufferedReader(new InputStreamReader(conn.getErrorStream(), "UTF-8"));
                    }

                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONObject result = new JSONObject();
                    result.put("status", code);
                    result.put("body", sb.toString());
                    promise.resolve(result.toString());
                } catch (Exception e) {
                    promise.reject("UPLOAD_ERROR", e.getMessage());
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        });
    }

    private HttpURLConnection openConnectionWithTls(URL url) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        if (conn instanceof HttpsURLConnection) {
            SSLSocketFactory factory = createTls12SocketFactory();
            if (factory != null) {
                ((HttpsURLConnection) conn).setSSLSocketFactory(factory);
            }
        }
        return conn;
    }

    private void downloadWithRedirects(String urlString, String token, String destPath, int maxRedirects) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlString);
            conn = openConnectionWithTls(url);
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(30000);
            conn.setInstanceFollowRedirects(false);
            if (token != null && !token.isEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer " + token);
            }

            int code = conn.getResponseCode();
            if (code >= 300 && code < 400 && maxRedirects > 0) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                conn = null;
                if (location != null) {
                    downloadWithRedirects(location, token, destPath, maxRedirects - 1);
                    return;
                }
                throw new Exception("Redirect with no Location header");
            }

            if (code >= 200 && code < 300) {
                InputStream is = conn.getInputStream();
                FileOutputStream fos = new FileOutputStream(destPath);
                byte[] buffer = new byte[8192];
                int len;
                while ((len = is.read(buffer)) != -1) {
                    fos.write(buffer, 0, len);
                }
                fos.close();
                is.close();
            } else {
                throw new Exception("HTTP " + code);
            }
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    @ReactMethod
    public void downloadFile(final String urlString, final String token, final String destPath, final Promise promise) {
        EXECUTOR.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    downloadWithRedirects(urlString, token, destPath, 5);
                    promise.resolve(destPath);
                } catch (Exception e) {
                    promise.reject("DOWNLOAD_ERROR", e.getMessage());
                }
            }
        });
    }

    // Open an already-downloaded local file in whatever app the device has
    // registered for its MIME type. Uses a file:// URI (no FileProvider) which
    // is valid on the BB10 Android runtime (< API 24, so no StrictMode block).
    // We only fire the intent when a handler actually exists — otherwise we
    // reject with NO_HANDLER so the JS layer can inform the user instead of
    // risking an unhandled-intent crash on the runtime.
    @ReactMethod
    public void openFile(final String path, final String mimeType, final Promise promise) {
        try {
            java.io.File file = new java.io.File(path);
            if (!file.exists()) {
                promise.reject("NOT_FOUND", "File not found");
                return;
            }

            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW);
            android.net.Uri uri = android.net.Uri.fromFile(file);
            intent.setDataAndType(uri, mimeType != null && mimeType.length() > 0 ? mimeType : "*/*");

            java.util.List<android.content.pm.ResolveInfo> handlers =
                getReactApplicationContext().getPackageManager().queryIntentActivities(intent, 0);
            if (handlers == null || handlers.isEmpty()) {
                promise.reject("NO_HANDLER", "No app can open this file type");
                return;
            }

            android.app.Activity activity = getCurrentActivity();
            if (activity != null) {
                activity.startActivity(intent);
            } else {
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(intent);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void uploadBinary(final String urlString, final String fileBase64, final String contentType, final Promise promise) {
        EXECUTOR.execute(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL(urlString);
                    conn = openConnectionWithTls(url);
                    conn.setRequestMethod("POST");
                    conn.setConnectTimeout(60000);
                    conn.setReadTimeout(60000);
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", contentType);

                    byte[] fileBytes = android.util.Base64.decode(fileBase64, android.util.Base64.DEFAULT);
                    conn.setRequestProperty("Content-Length", String.valueOf(fileBytes.length));

                    OutputStream os = conn.getOutputStream();
                    os.write(fileBytes);
                    os.flush();
                    os.close();

                    int code = conn.getResponseCode();
                    BufferedReader reader;
                    if (code >= 200 && code < 400) {
                        reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                    } else {
                        reader = new BufferedReader(new InputStreamReader(conn.getErrorStream(), "UTF-8"));
                    }

                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONObject result = new JSONObject();
                    result.put("status", code);
                    result.put("body", sb.toString());
                    promise.resolve(result.toString());
                } catch (Exception e) {
                    promise.reject("UPLOAD_ERROR", e.getMessage());
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        });
    }

    // Reads the process-wide cookie jar (installed in MainApplication) as a JSON
    // map of name -> value. The X login flow calls this after LoginSuccess to pull
    // out auth_token + ct0, which arrived via Set-Cookie across the flow.
    @ReactMethod
    public void getCookies(final Promise promise) {
        try {
            CookieHandler handler = CookieHandler.getDefault();
            JSONObject out = new JSONObject();
            if (handler instanceof CookieManager) {
                List<HttpCookie> cookies = ((CookieManager) handler).getCookieStore().getCookies();
                for (HttpCookie ck : cookies) {
                    out.put(ck.getName(), ck.getValue());
                }
            }
            promise.resolve(out.toString());
        } catch (Exception e) {
            promise.reject("COOKIE_ERROR", e.getMessage());
        }
    }

    // Clears the cookie jar so a fresh login flow doesn't inherit a stale guest
    // session (called before starting username/password login).
    @ReactMethod
    public void clearCookies(final Promise promise) {
        try {
            CookieHandler handler = CookieHandler.getDefault();
            if (handler instanceof CookieManager) {
                ((CookieManager) handler).getCookieStore().removeAll();
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("COOKIE_ERROR", e.getMessage());
        }
    }
}
