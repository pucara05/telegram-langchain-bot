import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';

@Injectable()
export class AiService {
    private model: ChatGroq;
    private histories = new Map<number, BaseMessage[]>();
    private readonly MAX_HISTORY = 20;

    constructor(private config: ConfigService) {
        this.model = new ChatGroq({
            apiKey: this.config.get<string>('GROQ_API_KEY'),
            model: 'llama-3.1-8b-instant',
        });
    }

    async chat(chatId: number, userMessage: string): Promise<string> {
        // 1. Obtener o crear historial para este chat
        if (!this.histories.has(chatId)) {
            this.histories.set(chatId, []);
        }
        const history = this.histories.get(chatId)!;

        // 2. Construir mensajes con historial completo
        const messages: BaseMessage[] = [
            new SystemMessage(
                'Eres un asistente útil en un grupo de Telegram. ' +
                'Responde siempre en español y de forma concisa.',
            ),
            ...history,
            new HumanMessage(userMessage),
        ];

        // 3. Invocar el modelo
        const response = await this.model.invoke(messages);
        const aiResponse = response.content as string;

        // 4. Guardar intercambio en historial
        history.push(new HumanMessage(userMessage));
        history.push(new AIMessage(aiResponse));

        // 5. Limitar historial
        if (history.length > this.MAX_HISTORY) {
            history.splice(0, 2);
        }

        return aiResponse;
    }

    clearHistory(chatId: number): void {
        this.histories.delete(chatId);
    }
}
