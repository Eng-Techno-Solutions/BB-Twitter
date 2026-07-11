package com.engtechnos.BBTwitter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.Socket;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

// Android 4.3 ships TLSv1.2 disabled by default, and slack.com rejects the
// legacy protocols/ciphers it does enable. Conscrypt (registered in
// MainApplication) provides a modern TLS stack; this wrapper forces TLSv1.2 on
// every socket it creates. Shared by HttpModule and NotificationPollService so
// background polling uses the exact same TLS path as in-app requests.
public class Tls12SocketFactory extends SSLSocketFactory {

    private final SSLSocketFactory delegate;

    // Building the SSLContext (Conscrypt provider lookup + init) is expensive on
    // Android 4.3 and was previously repeated on every request. The factory is
    // stateless and thread-safe, so build it once and reuse it across all polls,
    // sends, uploads, and image loads.
    private static volatile SSLSocketFactory cached;

    Tls12SocketFactory(SSLSocketFactory delegate) {
        this.delegate = delegate;
    }

    static SSLSocketFactory create() {
        SSLSocketFactory local = cached;
        if (local != null) return local;
        try {
            SSLContext sc = SSLContext.getInstance("TLSv1.2", "Conscrypt");
            sc.init(null, null, null);
            local = new Tls12SocketFactory(sc.getSocketFactory());
            cached = local;
            return local;
        } catch (Exception e) {
            return null;
        }
    }

    @Override public String[] getDefaultCipherSuites() { return delegate.getDefaultCipherSuites(); }
    @Override public String[] getSupportedCipherSuites() { return delegate.getSupportedCipherSuites(); }
    @Override public Socket createSocket(Socket s, String host, int port, boolean autoClose) throws IOException {
        return enableTls12(delegate.createSocket(s, host, port, autoClose));
    }
    @Override public Socket createSocket(String host, int port) throws IOException {
        return enableTls12(delegate.createSocket(host, port));
    }
    @Override public Socket createSocket(String host, int port, InetAddress localHost, int localPort) throws IOException {
        return enableTls12(delegate.createSocket(host, port, localHost, localPort));
    }
    @Override public Socket createSocket(InetAddress host, int port) throws IOException {
        return enableTls12(delegate.createSocket(host, port));
    }
    @Override public Socket createSocket(InetAddress address, int port, InetAddress localAddress, int localPort) throws IOException {
        return enableTls12(delegate.createSocket(address, port, localAddress, localPort));
    }

    private Socket enableTls12(Socket socket) {
        if (socket instanceof SSLSocket) {
            ((SSLSocket) socket).setEnabledProtocols(new String[]{"TLSv1.2"});
        }
        return socket;
    }
}
