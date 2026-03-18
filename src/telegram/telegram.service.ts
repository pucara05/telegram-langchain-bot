import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly apiUrl: string;
  private readonly logger = new Logger(TelegramService.name);

  constructor(private config: ConfigService) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text,
      });
    } catch (error) {
      this.logger.error(`❌ Error enviando mensaje al chat ${chatId}: ${error.message}`);
      // No relanzamos el error para que el webhook responda 200 igual
    }
  }
}