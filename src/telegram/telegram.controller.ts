import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { AiService } from '../ai/ai.service';
import { TelegramUpdateDto } from './dto/telegram-update.dto';

@Controller('telegram')
export class TelegramController {
  constructor(
    private telegramService: TelegramService,
    private aiService: AiService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() update: TelegramUpdateDto): Promise<void> {
    // 1. Ignorar updates sin mensaje o sin texto
    if (!update.message?.text) return;

    const chatId = update.message.chat.id;
    const userMessage = update.message.text;

    // 2. Obtener respuesta de la IA
    const aiResponse = await this.aiService.chat(userMessage);

    // 3. Enviar respuesta al chat
    await this.telegramService.sendMessage(chatId, aiResponse);
  }
}