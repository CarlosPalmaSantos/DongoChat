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
import { type Message, type User } from 'dongo-shared';

function getUser(client: Socket): User {
  return client.handshake.auth as User;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  conectedUsers: Record<string, Socket> = {};
  registeredUsers: Record<
    string,
    { inbox: Record<string, Message>; user: User }
  > = {};

  @WebSocketServer()
  server!: Server;

  getRegUser(u: User | Socket | string) {
    if (typeof u === 'string') return this.registeredUsers[u];
    if ('handshake' in u)
      return this.registeredUsers[(u.handshake.auth as User).id];
    return this.registeredUsers[u.id];
  }

  async handleConnection(client: Socket) {
    const auth: User = getUser(client);

    if (!(auth.id in this.registeredUsers)) {
      this.registeredUsers[auth.id] = {
        inbox: {},
        user: auth,
      };
    } else if (this.registeredUsers[auth.id].user.pass !== auth.pass) {
      Logger.debug('> Client incorrect password');
      client.disconnect(true);
      return;
    }

    Logger.debug(`> Client '${auth.id}' connected`);
    this.conectedUsers[auth.name] = client;

    await client.join(`inbox-${auth.id}`);

    const regUser = this.getRegUser(auth);

    Logger.debug(
      `SENDING INBOX [${JSON.stringify(Object.keys(regUser.inbox)).length}]`,
    );
    client.emit('connected-inbox', regUser.inbox);
    regUser.inbox = {};
  }

  handleDisconnect(client: Socket) {
    const auth = getUser(client);
    delete this.conectedUsers[auth.id];

    Logger.debug(`> Client '${auth.name}' disconnected`);
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): string {
    const auth = getUser(client);
    Logger.debug(`> PING FROM ${auth.id} `);
    return 'pong';
  }

  @SubscribeMessage('send-message')
  handleMsg(@MessageBody() data: Message, @ConnectedSocket() client: Socket) {
    Logger.debug(`> SEND ${JSON.stringify(data)} `);
    const sender = getUser(client).id;

    // TODO: Revisión de Timestamp
    const msg: Message = {
      ...data,
      id: v4(),
      sender,
    };

    // TODO: Revisión existencia de receiver
    const receiver = this.getRegUser(msg.receiver);
    if (!receiver) throw new Error('Inexistent Receiver');

    if (msg.receiver in this.conectedUsers) {
      this.server.to(`inbox-${data.receiver}`).emit('inbox-message', msg);
      Logger.debug(`Resending...`);
    } else {
      receiver.inbox[msg.id] = msg;
      Logger.debug(`Storing...`);
    }

    return msg;
  }
}
