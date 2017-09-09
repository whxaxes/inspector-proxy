'use strict';

const path = require('path');
const exec = require('child_process').exec;

exports.createServer = port => {
  const server = path.resolve(__dirname, './server.js');
  const proc = exec(`node ${server}${port ? ' --port=' + port : ''}`);
  return new Promise((resolve, reject) => {
    proc.stdout.once('data', port => {
      resolve({ process: proc, port: +port.trim() });
    });
    proc.stderr.once('data', reject);
    setTimeout(() => {
      reject('time out');
    }, 2000);
  });
}
;
