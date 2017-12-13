import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { buffer, createError, RequestHandler, run, send } from 'micro'

export interface ISerializedProxyResponse {
  headers: OutgoingHttpHeaders
  statusCode: number
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

export class Proxy {
  private io: SocketIO.Server
  public makeRequestListener(): RequestHandler {
    return (req, res) =>
      run(req, res, async (req, resp) => {
        const { method, url, headers } = req

        if (!method || !url) {
          throw createError(404, 'invalid HTTP/HTTPS request')
        }

        // const namespace = `/${req.headers.host || ''}`
        const namespace = `/`
        const sockets = Object.values(this.io.of(namespace).sockets)

        if (sockets.length === 0) {
          throw createError(503, 'No client connected')
        }

        if (sockets.length > 1) {
          throw createError(503, 'Two many client connected')
        }

        const socket = sockets[0]

        const request: ISerializedProxyRequest = { method, url, headers }
        const data = await buffer(req, { encoding: '' })

        if (data.length > 0) {
          request.rawData = data as Buffer
        }

        const proxyResponse = await new Promise<ISerializedProxyResponse>(
          resolve => socket.emit('request', request, resolve)
        )

        Object.entries(proxyResponse.headers).forEach(([name, value]) => {
          if (value) {
            resp.setHeader(name, value)
          }
        })

        send(resp, proxyResponse.statusCode, proxyResponse.rawData)
      })
  }

  public setSocketIO(io: SocketIO.Server) {
    this.io = io
  }
}
