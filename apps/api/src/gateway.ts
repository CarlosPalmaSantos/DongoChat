import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  handleConnection(client: Socket) {
    const auth = client.handshake.auth as {
      name: string;
      pass: string;
    };

    Logger.debug(`> Client '${auth.name}' connected`);
  }

  handleDisconnect(client: Socket) {
    const auth = client.handshake.auth as {
      name: string;
      pass: string;
    };

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
}
