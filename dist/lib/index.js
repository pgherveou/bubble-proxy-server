"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const micro_1 = require("micro");
function getRoom(hostname = '') {
    return `/${hostname}`;
}
class Proxy {
    makeRequestListener() {
        return (req, res) => micro_1.run(req, res, async (req, resp) => {
            const { method, url, headers } = req;
            if (!method || !url) {
                return micro_1.send(resp, 404, 'invalid HTTP/HTTPS request');
            }
            const roomName = getRoom(headers.host);
            const room = this.io.sockets.adapter.rooms[roomName];
            if (!room || room.length === 0) {
                return micro_1.send(resp, 503, 'No client connected');
            }
            if (room.length > 1) {
                return micro_1.send(resp, 503, `Too many client connected (${room.length})`);
            }
            const socketId = Object.keys(room.sockets)[0];
            const socket = this.io.sockets.connected[socketId];
            if (!socket) {
                return micro_1.send(resp, 503, 'No connected socket');
            }
            const request = { method, url, headers };
            const data = await micro_1.buffer(req, { encoding: '' });
            if (data.length > 0) {
                request.rawData = data;
            }
            const proxyResponse = await new Promise(resolve => {
                const onDisconnect = () => resolve({
                    status: 503,
                    headers: {},
                    rawData: 'Client disconnected'
                });
                const acknowledge = (response) => {
                    socket.removeListener('disconnect', onDisconnect);
                    resolve(response);
                };
                socket.once('disconnect', onDisconnect);
                socket.emit('request', request, acknowledge);
            });
            Object.entries(proxyResponse.headers).forEach(([name, value]) => {
                if (value) {
                    resp.setHeader(name, value);
                }
            });
            micro_1.send(resp, proxyResponse.status, proxyResponse.rawData);
        });
    }
    setSocketIO(io) {
        this.io = io;
        this.io.on('connection', socket => {
            const room = getRoom(socket.handshake.headers.host);
            socket.join(room);
        });
    }
}
exports.Proxy = Proxy;
