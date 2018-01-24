/// <reference types="node" />
/// <reference types="socket.io" />
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';
import { RequestHandler } from 'micro';
export interface ISerializedProxyResponse {
    headers: OutgoingHttpHeaders;
    status: number;
    rawData?: Buffer | string;
}
export interface ISerializedProxyRequest {
    method: string;
    headers: IncomingHttpHeaders;
    url: string;
    rawData?: Buffer;
}
export declare type ProxyRequestHandler = (request: ISerializedProxyRequest, callback: (response: ISerializedProxyResponse) => void) => void;
export declare class Proxy {
    private io;
    makeRequestListener(): RequestHandler;
    setSocketIO(io: SocketIO.Server): void;
}
