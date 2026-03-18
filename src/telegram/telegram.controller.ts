import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { AiService } from '../ai/ai.service';
import { TelegramUpdateDto } from './dto/telegram-update.dto';

@Controller('telegram')
export class TelegramController {
    private readonly logger = new Logger(TelegramController.name);

    constructor(
        private telegramService: TelegramService,
        private aiService: AiService,
    ) { }

    @Post('webhook')
    @HttpCode(200)
    async handleWebhook(@Body() update: TelegramUpdateDto): Promise<void> {
        if (!update.message?.text) return;

        const chatId = update.message.chat.id;
        const username = update.message.from?.first_name ?? 'Usuario';
        const userMessage = update.message.text;

        // Hora del servidor sin zona hardcodeada
        const timestamp = new Date().toLocaleString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });

        // Comando /reset → limpia el historial
        if (userMessage === '/reset') {
            await this.aiService.clearHistory(chatId); // ← agregar await
            await this.telegramService.sendMessage(chatId, '🧹 Historial limpiado. ¡Empecemos de nuevo!');
            return;
        }


        // Log mensaje del usuario
        this.logger.log(
            `\n┌─────────────────────────────────────\n` +
            `│ 👤 ${username} · 🕐 ${timestamp}\n` +
            `│ 💬 ${userMessage}\n` +
            `└─────────────────────────────────────`,
        );

        const aiResponse = await this.aiService.chat(chatId, userMessage);

        // Hora de respuesta del bot
        const responseTimestamp = new Date().toLocaleString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });

        // Log respuesta del bot
        this.logger.log(
            `\n┌─────────────────────────────────────\n` +
            `│ 🤖 Bot · 🕐 ${responseTimestamp}\n` +
            `│ 💡${aiResponse}\n` +
            `└─────────────────────────────────────`,
        );

        await this.telegramService.sendMessage(chatId, aiResponse);
    }
}