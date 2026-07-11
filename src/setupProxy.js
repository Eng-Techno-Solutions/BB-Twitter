// Web dev proxy — mirrors the native HttpModule's job on the web target: routes
// X's internal API through the dev server so the browser isn't blocked by CORS.
// Stays plain CJS (.js) because react-scripts requires it. Not part of typecheck.
//
// The client (src/utils/constants.ts#API) points web builds at these paths, then
// this proxy forwards them to the real X hosts with Origin/Referer set so X's
// internal endpoints accept the request.
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  const common = {
    changeOrigin: true,
    secure: true,
    logLevel: 'debug',
    headers: {
      Origin: 'https://x.com',
      Referer: 'https://x.com/'
    },
    // The browser strips the Cookie header from fetch, so the client relays the
    // session as x-bbt-cookie (xapi.ts#_headers on web). Rewrite it back to a real
    // Cookie here — the proxy is server-side and has no such restriction. This is
    // what makes the Session login testable on the web target.
    onProxyReq: function (proxyReq, req) {
      var cookie = req.headers['x-bbt-cookie'];
      if (cookie) {
        proxyReq.setHeader('Cookie', cookie);
        proxyReq.removeHeader('x-bbt-cookie');
      }
    }
  };

  // GraphQL: /x-gql/<queryId>/<Op> → https://x.com/i/api/graphql/<queryId>/<Op>
  app.use(
    '/x-gql',
    createProxyMiddleware(
      Object.assign({}, common, {
        target: 'https://x.com',
        pathRewrite: function (path) {
          return path.replace('/x-gql', '/i/api/graphql');
        }
      })
    )
  );

  // v1.1 JSON: /x-v11/... → https://api.x.com/1.1/...
  app.use(
    '/x-v11',
    createProxyMiddleware(
      Object.assign({}, common, {
        target: 'https://api.x.com',
        pathRewrite: function (path) {
          return path.replace('/x-v11', '/1.1');
        }
      })
    )
  );

  // v2 JSON: /x-v2/... → https://x.com/i/api/2/...
  app.use(
    '/x-v2',
    createProxyMiddleware(
      Object.assign({}, common, {
        target: 'https://x.com',
        pathRewrite: function (path) {
          return path.replace('/x-v2', '/i/api/2');
        }
      })
    )
  );

  // Media upload: /x-upload/... → https://upload.twitter.com/...
  app.use(
    '/x-upload',
    createProxyMiddleware(
      Object.assign({}, common, {
        target: 'https://upload.twitter.com',
        pathRewrite: function (path) {
          return path.replace('/x-upload', '');
        }
      })
    )
  );
};
