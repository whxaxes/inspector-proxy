'use strict';

const TCPProxy = require('tcp-proxy.js');
const urllib = require('urllib');
const co = require('co');
const KEY = '__ws_proxy__';
const proxy = new TCPProxy();

module.exports = (proxyPort, debugPort) =>
  co(function* () {
    const inspectInfo = yield getInspectInfo(debugPort);
    const wsId = inspectInfo.id;
    if (!wsId) {
      throw new Error('fetch inspect json failed');
    }

    yield proxy.createProxy({
      port: proxyPort,
      forwardPort: debugPort,
      interceptor: {
        client(chunk) {
          if (
            chunk[0] !== 0x47 || // G
            chunk[1] !== 0x45 || // E
            chunk[2] !== 0x54 || // T
            chunk[3] !== 0x20 // space
          ) {
            return;
          }

          const content = chunk.toString();

          // replace key to websocket id
          if (content.includes(KEY)) {
            return content.replace(KEY, wsId);
          }
        },
      },
    });

    return {
      url: `chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=127.0.0.1:${proxyPort}/${KEY}`,
    };
  }).catch(e => {
    throw e;
  });

function getInspectInfo(debugPort, count = 3) {
  return urllib
    .request(`http://127.0.0.1:${debugPort}/json`, {
      dataType: 'json',
    })
    .then(({ data }) => {
      return Promise.resolve(data[0]);
    })
    .catch(() => {
      if (!count) {
        return Promise.resolve({});
      }

      // delay 200ms to retry
      return new Promise(resolve => setTimeout(resolve, 200)).then(() =>
        getInspectInfo(debugPort, count - 1)
      );
    });
}
