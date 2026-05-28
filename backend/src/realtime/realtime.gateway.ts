import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

export interface MeasurementUpdatedPayload {
  projectId: string;
  unitId: string;
  activityTypeId: string;
  percentComplete: number;
  measuredById: string;
  measuredByName?: string;
}

export interface ScheduleUpdatedPayload {
  projectId: string;
  scheduleItemId: string;
  physicalProgress: number;
}

export interface ScheduleChangedPayload {
  projectId: string;
  /** Kind of structural change so the client knows what to refresh. */
  action: 'created' | 'updated' | 'deleted' | 'imported';
  scheduleItemId?: string;
}

interface AuthedSocket extends Socket {
  data: { userId: string; email: string };
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') as string | undefined) ||
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      this.logger.warn(`Conexão recusada (sem token): ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token);
      (client as AuthedSocket).data = { userId: payload.sub, email: payload.email };
      this.logger.log(`Realtime conectado: ${payload.email} (${client.id})`);
    } catch {
      this.logger.warn(`Conexão recusada (token inválido): ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Realtime desconectado: ${client.id}`);
  }

  @SubscribeMessage('subscribe:project')
  handleSubscribeProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    if (!data?.projectId) return { ok: false };
    const room = `project:${data.projectId}`;
    void client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('unsubscribe:project')
  handleUnsubscribeProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    if (!data?.projectId) return { ok: false };
    void client.leave(`project:${data.projectId}`);
    return { ok: true };
  }

  emitMeasurementUpdated(payload: MeasurementUpdatedPayload) {
    this.server.to(`project:${payload.projectId}`).emit('measurement:updated', payload);
  }

  emitScheduleUpdated(payload: ScheduleUpdatedPayload) {
    this.server.to(`project:${payload.projectId}`).emit('schedule:updated', payload);
  }

  /**
   * Estrutural — emitido quando itens são criados, deletados ou um import substitui
   * toda a EAP. Sinaliza ao cliente que ele deve recarregar dados derivados (tipos
   * de atividade, building data) que podem ter mudado.
   */
  emitScheduleChanged(payload: ScheduleChangedPayload) {
    this.server.to(`project:${payload.projectId}`).emit('schedule:changed', payload);
  }
}
