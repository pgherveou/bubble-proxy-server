import * as http from 'http'
import * as socketIO from 'socket.io'
import { Proxy } from '../lib/index'

const proxy = new Proxy()
const server = http.createServer(proxy.makeRequestListener())
proxy.setSocketIO(socketIO(server, { serveClient: false }))
server.listen(3001)
