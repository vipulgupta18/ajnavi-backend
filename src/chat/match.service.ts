import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

export type ChatMode = "text" | "video";
export type PublicProfile = { name: string; country: string; interests: string[] };
type WaitingUser = { socketId: string; mode: ChatMode; profile: PublicProfile; joinedAt: number };
type ActiveMatch = { partnerId: string; roomId: string };

@Injectable()
export class MatchService {
  private readonly waiting = new Map<string, WaitingUser>();
  private readonly matches = new Map<string, ActiveMatch>();
  private readonly blocked = new Map<string, Set<string>>();

  enqueue(socketId: string, mode: ChatMode, profile: PublicProfile) {
    this.remove(socketId);
    const normalized = this.normalizeProfile(profile);
    const candidates = [...this.waiting.values()].filter((candidate) =>
      candidate.mode === mode &&
      !this.blocked.get(socketId)?.has(candidate.socketId) &&
      !this.blocked.get(candidate.socketId)?.has(socketId),
    ).sort((a, b) => {
      const scoreA = a.profile.interests.filter((item) => normalized.interests.includes(item)).length;
      const scoreB = b.profile.interests.filter((item) => normalized.interests.includes(item)).length;
      return scoreB - scoreA || a.joinedAt - b.joinedAt;
    });
    const partner = candidates[0];
    if (!partner) { this.waiting.set(socketId, { socketId, mode, profile: normalized, joinedAt: Date.now() }); return null; }
    this.waiting.delete(partner.socketId);
    const roomId = randomUUID();
    this.matches.set(socketId, { partnerId: partner.socketId, roomId });
    this.matches.set(partner.socketId, { partnerId: socketId, roomId });
    return {
      roomId,
      partnerId: partner.socketId,
      partnerProfile: partner.profile,
      requesterProfile: normalized,
      sharedInterests: normalized.interests.filter((item) => partner.profile.interests.includes(item)),
    };
  }

  remove(socketId: string) {
    this.waiting.delete(socketId);
    const match = this.matches.get(socketId) ?? null;
    this.matches.delete(socketId);
    if (match) this.matches.delete(match.partnerId);
    return match;
  }

  isInRoom(socketId: string, roomId: string) { return this.matches.get(socketId)?.roomId === roomId; }

  blockCurrentPartner(socketId: string) {
    const partnerId = this.matches.get(socketId)?.partnerId;
    if (!partnerId) return null;
    if (!this.blocked.has(socketId)) this.blocked.set(socketId, new Set());
    if (!this.blocked.has(partnerId)) this.blocked.set(partnerId, new Set());
    this.blocked.get(socketId)!.add(partnerId);
    this.blocked.get(partnerId)!.add(socketId);
    return partnerId;
  }

  stats() { return { waiting: this.waiting.size, connected: this.matches.size, activeChats: this.matches.size / 2 }; }

  private normalizeProfile(profile: PublicProfile): PublicProfile {
    return {
      name: String(profile?.name ?? "Stranger").trim().slice(0, 40) || "Stranger",
      country: String(profile?.country ?? "").trim().slice(0, 60),
      interests: [...new Set((profile?.interests ?? []).map((item) => String(item).trim().toLowerCase()).filter(Boolean))].slice(0, 10),
    };
  }
}
