import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { timestamp } from 'rxjs';
import { Socket, Server } from 'socket.io';
import { v4 } from 'uuid';

@WebSocketGateway({ cors: { origin: '*' } })
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  users: Record<string, Socket> = {};

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth as {
      name: string;
      pass: string;
    };

    Logger.debug(`> Client '${auth.name}' connected`);
    this.users[auth.name] = client;
    await client.join(`inbox-${auth.name}`);

    setTimeout(() => {
      Logger.debug('SENDING');
      this.server.to(`inbox-${auth.name}`).emit('inbox-message', {
        id: v4(),
        timestamp: Date.now(),
        sender: 'system',
        receiver: auth.name,
        content: 'You are login',
      });
    }, 500);
  }

  handleDisconnect(client: Socket) {
    const auth = client.handshake.auth as {
      name: string;
      pass: string;
    };

    delete this.users[auth.name];

    Logger.debug(`> Client '${auth.name}' disconnected`);
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): string {
    Logger.debug(`> PING FROM ${client.handshake.auth.name}`);
    return 'pong';
  }

  @SubscribeMessage('send-message')
  handleMsg(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    Logger.debug(`> SEND ${JSON.stringify(data)}`);
    this.server.to(`inbox-${data.receiver}`).emit('inbox-message', data);
  }
}
