'use strict';

const http = require('http');

http.createServer((req, res) => {
  res.end(`${process.pid}`);
}).listen(7001);
