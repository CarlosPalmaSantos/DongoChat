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
import { Socket, Server } from 'socket.io';
import { v4 } from 'uuid';
import { type Message } from 'dongo-shared';

@WebSocketGateway({ cors: { origin: '*' } })
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  conectedUsers: Record<string, Socket> = {};
  storedUsers: Record<string, Record<string, Message>> = {};

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth as {
      name: string;
      pass: string;
    };

    Logger.debug(`> Client '${auth.name}' connected`);
    this.conectedUsers[auth.name] = client;
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

    if (auth.name in this.storedUsers) {
      Logger.debug(
        `SENDING INBOX [${JSON.stringify(this.storedUsers[auth.name])}]`,
      );
      client.emit('connected-inbox', this.storedUsers[auth.name]);
      delete this.storedUsers[auth.name];
    }
  }

  handleDisconnect(client: Socket) {
    const auth = client.handshake.auth as {
      name: string;
      pass: string;
    };

    delete this.conectedUsers[auth.name];

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
  handleMsg(@MessageBody() data: Message, @ConnectedSocket() client: Socket) {
    Logger.debug(`> SEND ${JSON.stringify(data)}`);
    const sender = client.handshake.auth.name;

    // TODO: Revisión de Timestamp
    const msg: Message = {
      ...data,
      id: v4(),
      sender,
    };

    if (msg.receiver in this.conectedUsers) {
      this.server.to(`inbox-${data.receiver}`).emit('inbox-message', msg);
      Logger.debug(`Resending...`);
    } else {
      if (!this.storedUsers[msg.receiver]) this.storedUsers[msg.receiver] = {};
      this.storedUsers[msg.receiver][msg.id] = msg;
      Logger.debug(`Storing...`);
    }

    return msg;
  }
}
