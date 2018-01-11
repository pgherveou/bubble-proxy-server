"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const socketIO = require("socket.io");
const index_1 = require("../lib/index");
const proxy = new index_1.Proxy();
const server = http.createServer(proxy.makeRequestListener());
proxy.setSocketIO(socketIO(server, { serveClient: false }));
server.listen(3001);
