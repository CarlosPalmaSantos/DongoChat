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
import { type Message, type User, Id, cleanText } from 'dongo-shared';

function getUser(client: Socket): User {
  return client.handshake.auth as User;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173', // dev con Vite
      'https://dongochat.magin.top', // web en producción
      'capacitor://localhost', // app nativa en iOS (iosScheme por defecto: 'capacitor')
      'https://localhost', // app nativa en Android (androidScheme por defecto desde Capacitor 5: 'https')
      'http://localhost', // fallback por si usas Capacitor < 5 o cambias androidScheme
    ],
  },
})
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  conectedUsers: Record<string, Socket> = {};
  registeredUsers: Record<
    string,
    { inbox: Record<string, Message>; user: User }
  > = {};

  @WebSocketServer()
  server!: Server;

  getRegUser(u: User | Socket | string) {
    let id;
    if (typeof u === 'string') id = u;
    else if ('handshake' in u) id = (u.handshake.auth as User).id;
    else id = u.id;

    return this.registeredUsers[cleanText(id)];
  }

  async handleConnection(client: Socket) {
    const auth: User = getUser(client);
    const aid = cleanText(auth.id);

    if (!(aid in this.registeredUsers)) {
      this.registeredUsers[aid] = {
        inbox: {},
        user: {
          ...auth,
          id: aid,
        },
      };
    } else if (this.registeredUsers[aid].user.pass !== auth.pass) {
      Logger.debug('> Client incorrect password');
      client.emit('connection-error', {
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect password for this user id',
      });
      client.disconnect(true);
      return;
    }

    Logger.debug(`> Client '${aid}' connected`);
    this.conectedUsers[aid] = client;

    await client.join(`inbox-${aid}`);

    const regUser = this.getRegUser(auth);

    if (!regUser) {
      client.emit('connection-error', {
        code: 'UNKNOWN_ERROR',
        message: 'idk',
      });
      client.disconnect(true);
      return;
    }

    Logger.debug(`SENDING INBOX [${Object.keys(regUser.inbox).length}]`);
    Logger.debug(JSON.stringify(Object.values(regUser.inbox)));

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
      id: Id.gen(),
      timestamp: Date.now(),
      sender,
    };

    // TODO: Revisión existencia de receiver
    const receiver = this.getRegUser(msg.receiver);
    if (!receiver) throw new Error('Inexistent Receiver');

    receiver.inbox[msg.id] = msg;
    this.server.to(`inbox-${data.receiver}`).emit('inbox-message', msg);

    return msg;
  }

  @SubscribeMessage('ack-message')
  handleAck(@MessageBody() msgId: string, @ConnectedSocket() client: Socket) {
    const auth = getUser(client);
    const regUser = this.getRegUser(auth.id);

    if (regUser && regUser.inbox[msgId]) {
      delete regUser.inbox[msgId];
      Logger.debug(`< ACK received for ${msgId}. Message removed from inbox.`);
    }
  }

  @SubscribeMessage('ack-connected-inbox')
  handleAckInbox(@ConnectedSocket() client: Socket) {
    const auth = getUser(client);
    const regUser = this.getRegUser(auth.id);

    if (regUser) {
      regUser.inbox = {};
      Logger.debug(`< Cleared inbox for connected user ${auth.id}`);
    }
  }
}
