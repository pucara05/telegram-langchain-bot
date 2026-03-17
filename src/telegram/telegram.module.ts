import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { AiModule } from 'src/ai/ai.module';


@Module({
  imports: [AiModule],        // ← importamos AiModule para usar AiService
  controllers: [TelegramController],
  providers: [TelegramService]
})
export class TelegramModule { }
