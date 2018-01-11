import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { buffer, createError, RequestHandler, run, send } from 'micro'

export interface ISerializedProxyResponse {
  headers: OutgoingHttpHeaders
  status: number
  rawData?: Buffer
}

export interface ISerializedProxyRequest {
  method: string
  headers: IncomingHttpHeaders
  url: string
  rawData?: Buffer
}

export type ProxyRequestHandler = (
  request: ISerializedProxyRequest,
  callback: (response: ISerializedProxyResponse) => void
) => void

function getRoom(hostname: string = '') {
  return `/${hostname || ''}`
}

export class Proxy {
  private io: SocketIO.Server
  public makeRequestListener(): RequestHandler {
    return (req, res) =>
      run(req, res, async (req, resp) => {
        const { method, url, headers } = req

        if (!method || !url) {
          throw createError(404, 'invalid HTTP/HTTPS request')
        }

        const roomName = getRoom(headers.host)
        const room = this.io.sockets.adapter.rooms[roomName]
        console.log(`sending request to socket in ${roomName}`)

        if (!room || room.length === 0) {
          throw createError(503, 'No client connected')
        }

        if (room.length > 1) {
          throw createError(503, `Too many client connected (${room.length})`)
        }

        const socketId = Object.keys(room.sockets)[0]
        const socket = this.io.sockets.connected[socketId]

        if (!socket) {
          throw createError(503, `No connected socket`)
        }

        const request: ISerializedProxyRequest = { method, url, headers }
        const data = await buffer(req, { encoding: '' })

        if (data.length > 0) {
          request.rawData = data as Buffer
        }

        const proxyResponse = await new Promise<ISerializedProxyResponse>(
          (resolve, reject) => {
            const onDisconnect = () =>
              reject(createError(503, 'Client disconnected'))

            const acknowledge = (response: ISerializedProxyResponse) => {
              socket.removeListener('disconnect', onDisconnect)
              resolve(response)
            }

            socket.once('disconnect', onDisconnect)
            socket.emit('request', request, acknowledge)
          }
        )

        Object.entries(proxyResponse.headers).forEach(([name, value]) => {
          if (value) {
            resp.setHeader(name, value)
          }
        })

        send(resp, proxyResponse.status, proxyResponse.rawData)
      })
  }

  public setSocketIO(io: SocketIO.Server) {
    this.io = io
    this.io.on('connection', socket => {
      const room = getRoom(socket.handshake.headers.host)
      console.log(`socket joining ${room}`)
      socket.join(room)
    })
  }
}
