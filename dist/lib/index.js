"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const micro_1 = require("micro");
class Proxy {
    makeRequestListener() {
        return (req, res) => micro_1.run(req, res, async (req, resp) => {
            const { method, url, headers } = req;
            if (!method || !url) {
                throw micro_1.createError(404, 'invalid HTTP/HTTPS request');
            }
            const sockets = Object.values(this.io.of('/').sockets);
            if (sockets.length === 0) {
                throw micro_1.createError(503, 'No client connected');
            }
            if (sockets.length > 1) {
                throw micro_1.createError(503, 'Too many client connected');
            }
            const socket = sockets[0];
            const request = { method, url, headers };
            const data = await micro_1.buffer(req, { encoding: '' });
            if (data.length > 0) {
                request.rawData = data;
            }
            const proxyResponse = await new Promise((resolve, reject) => {
                const onDisconnect = () => reject(micro_1.createError(503, 'Client disconnected'));
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
    }
}
exports.Proxy = Proxy;
