'use strict';

const http = require('http');
const url = require('url');
const WebSocket = require('ws');
const wsId = '123123123123';
const port = process.argv
  .filter(item => item.startsWith('--port='))
  .map(item => item.match(/\d+/)[0])[0];

const server = http
  .createServer((req, res) => {
    const urlObj = url.parse(req.url);
    if (urlObj.path === '/json') {
      res.end(JSON.stringify([{
        devtoolsFrontendUrl: `https://chrome-devtools-frontend.appspot.com/serve_file/@60cd6e859b9f557d2312f5bf532f6aec5f284980/inspector.html?experiments=true&v8only=true&ws=127.0.0.1:${server.address().port}/${wsId}`,
        id: wsId,
      }]));
    } else if (urlObj.path === '/pid') {
      res.end(process.pid);
    }
  })
  .listen(port || 0, () => {
    console.log(server.address().port);
  });

const wss = new WebSocket.Server({
  server,
  path: `/${wsId}`,
});

wss.on('connection', function connection(ws) {
  ws.on('message', () => {
    ws.send('111');
  });
});
