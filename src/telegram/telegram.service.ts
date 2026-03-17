import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly apiUrl: string;

  constructor(private config: ConfigService) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    await axios.post(`${this.apiUrl}/sendMessage`, {
      chat_id: chatId,
      text,
    });
  }
}