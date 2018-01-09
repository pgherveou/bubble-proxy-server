import http from 'http'
import https from 'https'
import ioClient from 'socket.io-client'
import certificates from 'openssl-self-signed-certificate'
import socketIO from 'socket.io'
import superagent from 'superagent'
import test from 'ava'
import { Proxy } from '../dist/lib'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

async function makeServer() {
  return new Promise(resolve => {
    const proxy = new Proxy()
    const server = http.createServer(proxy.makeRequestListener())
    proxy.setSocketIO(socketIO(server))
    server.listen(0, () =>
      resolve({
        server,
        proxy,
        url: `http://localhost:${server.address().port}`
      })
    )
  })
}

async function makeSecureServer() {
  return new Promise(resolve => {
    const proxy = new Proxy()
    const server = https.createServer(certificates, proxy.makeRequestListener())
    proxy.setSocketIO(socketIO(server, { transports: ['websocket'] }))
    server.listen(0, () =>
      resolve({
        server,
        proxy,
        url: `https://localhost:${server.address().port}`
      })
    )
  })
}

test('No client connected', async t => {
  const { url, server } = await makeServer()
  try {
    await superagent.get(url)
  } catch (err) {
    t.true(err.response.status === 503)
    t.true(
      err.response.text.split('\n').shift() === 'Error: No client connected'
    )
  } finally {
    server.close()
  }
})

test('Too many client connected', async t => {
  const { url, server } = await makeServer()
  const sockets = Array(2)
    .fill('')
    .map(() =>
      ioClient(url, {
        multiplex: false,
        transports: ['websocket']
      })
    )

  await Promise.all(
    sockets.map(s => new Promise(resolve => s.once('connect', () => resolve())))
  )

  try {
    await superagent.get(url)
  } catch (err) {
    t.true(err.response.status === 503)
    t.true(
      err.response.text.split('\n').shift() ===
        'Error: Too many client connected'
    )
  } finally {
    server.close()
  }
})

test('Socket disconnect', async t => {
  const { url, server } = await makeServer()
  const io = ioClient(url, { transports: ['websocket'] })

  io.once('request', async (request, ack) => {
    io.disconnect()
  })

  try {
    await new Promise(resolve => io.once('connect', () => resolve()))
    const response = await superagent.get(url)
  } catch (err) {
    t.true(err.response.status === 503)
    t.true(
      err.response.text.split('\n').shift() === 'Error: Client disconnected'
    )
  } finally {
    server.close()
  }
})

test('Get response from socket', async t => {
  const { url, server } = await makeSecureServer()
  const io = ioClient(url, {
    transports: ['websocket'],
    rejectUnauthorized: false
  })

  const response = {
    headers: { 'x-test': 'test', 'content-type': 'text' },
    status: 200,
    rawData: Buffer.from('hello')
  }

  io.once('request', async (request, ack) => {
    ack(response)
  })

  try {
    await new Promise(resolve => io.once('connect', () => resolve()))
    const actualResponse = await superagent.get(url)
    t.true(actualResponse.status == response.status)
    t.true(actualResponse.headers['x-test'] == response.headers['x-test'])
    t.true(actualResponse.text == response.rawData.toString())
  } finally {
    server.close()
  }
})
