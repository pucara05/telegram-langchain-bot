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
      console.log("📤 Enviando mensaje:", text);

      const res = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text,
      });

      console.log("✅ Telegram response:", res.data);

    } catch (error: any) {
      console.error("❌ ERROR TELEGRAM FULL:");
      console.error("STATUS:", error.response?.status);
      console.error("DATA:", error.response?.data);
      console.error("MESSAGE:", error.message);
    }
  }
}