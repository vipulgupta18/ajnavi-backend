import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { ChatGateway } from "./chat/chat.gateway";
import { MatchService } from "./chat/match.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [ChatGateway, MatchService],
})
export class AppModule {}
