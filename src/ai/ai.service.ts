import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

@Injectable()
export class AiService {
    private model: ChatGroq;

    constructor(private config: ConfigService) {
        this.model = new ChatGroq({
            apiKey: this.config.get<string>('GROQ_API_KEY'),
            model: 'llama-3.1-8b-instant',
        });
    }

    async chat(userMessage: string): Promise<string> {
        const messages = [
            new SystemMessage('Eres un asistente útil en un grupo de Telegram. Responde siempre en español y de forma concisa.'),
            new HumanMessage(userMessage),
        ];

        const response = await this.model.invoke(messages);
        return response.content as string;
    }
}
