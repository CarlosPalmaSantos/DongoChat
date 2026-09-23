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
import { type Message, type User, Id, ParseUser } from 'dongo-shared';
import { AppService, UserEntry } from './app.service';
import crypto, { createHash } from 'crypto';

type ConnectionErrorCode = 'INVALID_VALUE' | 'TEMPORAL_USER';

class ConnectionError extends Error {
  constructor(
    message: string,
    public code: ConnectionErrorCode,
  ) {
    super(message); // Call the constructor of the base class `Error`
    this.name = 'ConnectionError'; // Set the error name to your custom error class name
    // Set the prototype explicitly to maintain the correct prototype chain
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
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
  constructor(private readonly appService: AppService) { }
  conectedUsers: Record<string, Socket> = {};

  @WebSocketServer()
  server!: Server;

  async registerUser(client: Socket, user: User) {
    Logger.log(`Registering ${user.id}`);
    const res = (await client.emitWithAck('req_puk')) as unknown;

    if (typeof res !== 'string')
      throw new ConnectionError(
        'The PuK request got an invalid response',
        'INVALID_VALUE',
      );

    const newUser = new UserEntry(
      {},
      {
        id: createHash('sha256').update(res).digest('base64'),
        name: user.name,
      },
      res,
    );

    this.appService.saveUser(newUser);
    return newUser;
  }

  async loginUser(client: Socket, user: UserEntry) {
    Logger.log(`Login ${user.user.id}`);

    const validation = crypto.randomBytes(64);
    Logger.debug(user);

    const encryptedValidation = crypto
      .publicEncrypt(
        {
          key: user.puk,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        validation,
      )
      .toString('base64');

    const res: unknown = await client.emitWithAck(
      'test_puk',
      encryptedValidation,
    );

    if (typeof res !== 'string' || res !== validation.toString('base64'))
      throw new ConnectionError(
        'Invalid response to the PuK test',
        'INVALID_VALUE',
      );
  }

  async handleConnection(client: Socket) {
    try {
      const auth = ParseUser(client.handshake.auth);
      Logger.log(`Connecting ${auth?.name}`);

      if (!auth || auth.id === '' || auth.name === '') {
        throw new ConnectionError('Invalid credentials', 'INVALID_VALUE');
      }

      let user = this.appService.searchUser(auth.id);

      if (!user) {
        user = await this.registerUser(client, auth);
      }

      if (!(user instanceof UserEntry))
        throw new ConnectionError(
          'The user is already registering',
          'TEMPORAL_USER',
        );

      await this.loginUser(client, user);

      this.conectedUsers[auth.id] = client;

      await client.join(`inbox-${auth.id}`);

      Logger.debug(`SENDING INBOX [${Object.keys(user.inbox).length}]`);
      Logger.debug(user.inbox);

      client
        .emitWithAck('connected-inbox', user.inbox)
        .then((_) => {
          Logger.warn(`Removing Inbox: ${user.user.id}`);
          user.inbox = {};
        })
        .catch(() => { });
    } catch (e: unknown) {
      if (e instanceof ConnectionError) {
        Logger.error(e);
        client.emit('connection-error', {
          message: e.message,
          code: e.code,
        });
      } else if (e instanceof Error) {
        client.emit('connection-error', {
          message: e.message,
          code: 'UNOWN_ERROR',
        });
      }
    }
  }

  handleDisconnect(client: Socket) {
    const auth = ParseUser(client.handshake.auth);

    // TODO: Investigar si lanzar excepción
    if (!auth) return;

    delete this.conectedUsers[auth.id];

    Logger.debug(`> Client '${auth.name}' disconnected`);
  }

  @SubscribeMessage('list-user')
  handleListUser(@MessageBody() input: string) {
    // TODO: Agregar mínimo de 3 dígitos
    return this.appService.listUser(input);
  }

  @SubscribeMessage('get-user')
  handleGetUser(@MessageBody() id: string) {
    // TODO: Agregar mínimo de 3 dígitos

    Logger.log('GetUser');
    return this.appService.searchUser(id, false);
  }

  @SubscribeMessage('message-received')
  handleMessageReceived(
    @MessageBody() id: string,
    @ConnectedSocket() client: Socket,
  ) {
    const auth = ParseUser(client.handshake.auth);
    //
    // TODO: Investigar si lanzar excepción
    if (!auth) return;

    const user = this.appService.searchUser(auth.id);

    if (!user || user === 'temp') return;

    Logger.log('Removing message');
    delete user.inbox[id];
  }

  @SubscribeMessage('send-message')
  handleMsg(@MessageBody() data: Message, @ConnectedSocket() client: Socket) {
    try {
      const auth = ParseUser(client.handshake.auth);

      console.log(data);
      console.log(client.handshake.auth);

      // TODO: Investigar si lanzar excepción
      if (!auth) return;

      const sender = this.appService.searchUser(auth.id);
      const receiver = this.appService.searchUser(data.receiver);

      Logger.log('Sending message');
      console.log(data.receiver);

      if (!sender || sender === 'temp')
        throw new ConnectionError('User is temporal user', 'TEMPORAL_USER');

      if (!receiver || receiver === 'temp')
        throw new ConnectionError('Receiver is temporal user', 'TEMPORAL_USER');

      const msg: Message & { senderInfo: User } = {
        id: Id.gen(),
        timestamp: Date.now(),
        sender: sender.user.id,
        receiver: receiver.user.id,
        senderInfo: sender.user,
        content: data.content,
      };

      receiver.inbox[msg.id] = msg;
      this.server.to(`inbox-${receiver.user.id}`).emit('inbox-message', msg);

      return msg;
    } catch (e: unknown) {
      Logger.error(e);
      if (e instanceof ConnectionError) {
        client.emit('connection-error', {
          message: e.message,
          code: e.code,
        });
      } else if (e instanceof Error) {
        client.emit('connection-error', {
          message: e.message,
          code: 'UNOWN_ERROR',
        });
      }
    }
  }
}
