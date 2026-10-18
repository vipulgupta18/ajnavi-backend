import { Logger } from "@nestjs/common";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { Server, Socket } from "socket.io";
import { ChatMode, MatchService, PublicProfile } from "./match.service";

class MatchDto {
  @IsIn(["text", "video"]) mode: ChatMode = "text";
  @IsOptional() @IsObject() profile: PublicProfile = { name: "Stranger", country: "", interests: [] };
  @IsOptional() @IsArray() @IsString({ each: true }) interests: string[] = [];
}
class MessageDto { @IsString() roomId: string; @IsString() @MaxLength(500) text: string; }
class SignalDto { @IsString() roomId: string; @IsString() type: string; data: unknown; }
class ReportDto { @IsString() roomId: string; @IsString() @MaxLength(120) reason: string; }
type ReportRecord = { roomId: string; reporterSocketId: string; reportedSocketId: string; reason: string; createdAt: string };

@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:3000", credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly reports: ReportRecord[] = [];
  constructor(private readonly matches: MatchService) {}

  handleConnection(client: Socket) { this.logger.log(`Connected ${client.id}`); }
  handleDisconnect(client: Socket) { this.leave(client); }

  @SubscribeMessage("find-match")
  async find(@ConnectedSocket() client: Socket, @MessageBody() body: MatchDto): Promise<{ queued: true } | void> {
    await this.leave(client);
    const profile = { ...(body?.profile ?? {}), interests: body?.interests ?? body?.profile?.interests ?? [] } as PublicProfile;
    const match = this.matches.enqueue(client.id, body?.mode ?? "text", profile);
    if (!match) return { queued: true };
    const partner = this.server.sockets.sockets.get(match.partnerId);
    if (!partner) { this.matches.remove(client.id); return this.find(client, body); }
    await Promise.all([client.join(match.roomId), partner.join(match.roomId)]);
    client.emit("matched", { roomId: match.roomId, peerId: partner.id, initiator: true, sharedInterests: match.sharedInterests, partner: match.partnerProfile });
    partner.emit("matched", { roomId: match.roomId, peerId: client.id, initiator: false, sharedInterests: match.sharedInterests, partner: match.requesterProfile });
  }

  @SubscribeMessage("signal")
  signal(@ConnectedSocket() client: Socket, @MessageBody() body: SignalDto) {
    if (!this.matches.isInRoom(client.id, body.roomId) || !client.rooms.has(body.roomId) || !["offer", "answer", "ice-candidate"].includes(body.type)) return;
    client.to(body.roomId).emit("signal", { type: body.type, data: body.data });
  }

  @SubscribeMessage("chat-message")
  message(@ConnectedSocket() client: Socket, @MessageBody() body: MessageDto) {
    if (!this.matches.isInRoom(client.id, body.roomId) || !client.rooms.has(body.roomId)) return;
    const text = body.text.trim();
    if (text) client.to(body.roomId).emit("chat-message", { text, sentAt: new Date().toISOString() });
  }

  @SubscribeMessage("next-match") leaveChat(@ConnectedSocket() client: Socket) { this.leave(client); }
  @SubscribeMessage("leave-chat") explicitLeave(@ConnectedSocket() client: Socket) { this.leave(client); }

  @SubscribeMessage("report-user")
  report(@ConnectedSocket() client: Socket, @MessageBody() body: ReportDto) {
    if (!body.roomId || !this.matches.isInRoom(client.id, body.roomId) || !client.rooms.has(body.roomId)) return;
    const reportedSocketId = this.matches.blockCurrentPartner(client.id);
    if (!reportedSocketId) return;
    this.reports.push({ roomId: body.roomId, reporterSocketId: client.id, reportedSocketId, reason: body.reason?.trim() || "unspecified", createdAt: new Date().toISOString() });
    if (this.reports.length > 1000) this.reports.shift();
    client.emit("report-received");
  }

  private async leave(client: Socket) {
    const match = this.matches.remove(client.id);
    if (match) this.server.to(match.partnerId).emit("partner-left");
    const rooms = [...client.rooms].filter((room) => room !== client.id);
    for (const roomId of rooms) await client.leave(roomId);
  }
}
