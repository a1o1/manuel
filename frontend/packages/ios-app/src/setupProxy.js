const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod',
      changeOrigin: true,
      secure: false,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying request:', req.method, req.url);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('Proxy response:', proxyRes.statusCode);
      }
    })
  );
};
