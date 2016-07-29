/// <reference path='../../../../../third_party/typings/browser.d.ts' />

import logging = require('../../logging/logging');
import piece = require('../piece');

declare const freedom: freedom.FreedomInModuleEnv;

const log: logging.Log = new logging.Log('freedom socks server');

export class FreedomSocksServer {
  // Number of instances created, for logging purposes.
  private static id_ = 0;

  private serverSocket: freedom.TcpSocket.Socket = freedom['core.tcpsocket']();

  // Number of sessions created, for logging.
  private numSessions_ = 0;

  constructor(
    private requestedAddress_: string,
    private requestedPort_: number,
    private name_: string = 'unnamed-socks-server-' + FreedomSocksServer.id_) {
    FreedomSocksServer.id_++;
  }

  private getSocksSession_: () => piece.SocksPiece;
  public onConnection = (callback: () => piece.SocksPiece): FreedomSocksServer => {
    this.getSocksSession_ = callback;
    return this;
  }

  public listen = () => {
    return this.serverSocket.listen(this.requestedAddress_, this.requestedPort_).then(() => {
      this.serverSocket.on('onConnection', (connectInfo: freedom.TcpSocket.ConnectInfo) => {
        const clientId = connectInfo.host + ':' + connectInfo.port;
        log.info('%1: new SOCKS client %2', this.name_, clientId);

        const clientSocket = freedom['core.tcpsocket'](connectInfo.socket);

        const socksSession = this.getSocksSession_();

        // onDataForSocksClient
        socksSession.onData((buffer: ArrayBuffer) => {
          clientSocket.write(buffer);
        });

        // onForwardingSocketDisconnect
        socksSession.onDisconnect(() => {
          log.debug('%1: forwarding socket for SOCKS client %2 has disconnected', this.name_, clientId);
        });

        clientSocket.on('onData', (info: freedom.TcpSocket.ReadInfo) => {
          socksSession.handleData(info.data);
        });

        clientSocket.on('onDisconnect', (info: freedom.TcpSocket.DisconnectInfo) => {
          log.info('%1: disconnected from SOCKS client %2 (%3)', this.name_, clientId, info);
          // TODO: use counter to guard against early onDisconnect notifications
          freedom['core.tcpsocket'].close(clientSocket);
          socksSession.handleDisconnect();
        });
      });
    });
  }
}