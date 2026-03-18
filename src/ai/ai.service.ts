import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGroq } from '@langchain/groq';
import {
    HumanMessage,
    SystemMessage,
    BaseMessage,
} from '@langchain/core/messages';
import { RedisChatMessageHistory } from '@langchain/community/stores/message/ioredis';
import Redis from 'ioredis';

@Injectable()
export class AiService implements OnModuleDestroy {
    private model: ChatGroq;
    private redisClient: Redis;

    private readonly SYSTEM_PROMPT =
        'Eres un asistente útil en un grupo de Telegram. ' +
        'Responde siempre en español y de forma concisa.';

    private readonly TTL = 86400; // 24 horas en segundos

    constructor(private config: ConfigService) {
        this.model = new ChatGroq({
            apiKey: this.config.get<string>('GROQ_API_KEY'),
            model: 'llama-3.1-8b-instant',
        });

        this.redisClient = new Redis(
            this.config.get<string>('REDIS_URL') as string,
        );
    }

    // Se ejecuta cuando NestJS apaga el módulo
    async onModuleDestroy(): Promise<void> {
        await this.redisClient.quit();
    }

    private getHistory(chatId: number): RedisChatMessageHistory {
        return new RedisChatMessageHistory({
            sessionId: `chat:${chatId}`,
            sessionTTL: this.TTL,
            client: this.redisClient,
        });
    }

    async chat(chatId: number, userMessage: string): Promise<string> {
        const chatHistory = this.getHistory(chatId);

        // 1. Obtener historial desde Redis
        const history: BaseMessage[] = await chatHistory.getMessages();

        // 2. Construir mensajes con historial
        const messages: BaseMessage[] = [
            new SystemMessage(this.SYSTEM_PROMPT),
            ...history,
            new HumanMessage(userMessage),
        ];

        // 3. Invocar el modelo
        const response = await this.model.invoke(messages);
        const aiResponse = response.content as string;

        // 4. Guardar en Redis
        await chatHistory.addUserMessage(userMessage);
        await chatHistory.addAIMessage(aiResponse);

        return aiResponse;
    }

    async clearHistory(chatId: number): Promise<void> {
        const chatHistory = this.getHistory(chatId);
        await chatHistory.clear();
    }
}