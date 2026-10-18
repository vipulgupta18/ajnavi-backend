import { Controller, Get } from "@nestjs/common";
import { MatchService } from "./chat/match.service";

@Controller()
export class AppController {
  constructor(private readonly matches: MatchService) {}

  @Get("health")
  health() { return { status: "ok", service: "ajnavi-api", persistence: "in-memory", ...this.matches.stats(), timestamp: new Date().toISOString() }; }
}
