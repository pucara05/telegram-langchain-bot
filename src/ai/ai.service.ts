import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
//import { ChatGroq } from '@langchain/groq';
//import { ChatMistralAI } from '@langchain/mistralai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { RedisChatMessageHistory } from '@langchain/community/stores/message/ioredis';
import Redis from 'ioredis';
import { getTimeTool } from '../tools/get-time.tool';
import { createGetWeatherTool } from '../tools/get-weather.tool';
import { createSearchWebTool } from '../tools/search-web.tool';


@Injectable()
export class AiService implements OnModuleDestroy {
  private model: ChatGoogleGenerativeAI;
  private modelWithTools: any;
  private redisClient: Redis;
  private tools: any[];

  private readonly SYSTEM_PROMPT =
    `
Eres un asistente inteligente en un grupo de Telegram.
Responde siempre en español y de forma concisa y clara.

HERRAMIENTAS DISPONIBLES:
Tienes acceso a tools para obtener información en tiempo real.
Úsalas ÚNICAMENTE cuando el contexto lo requiera:
- getTime: usar SOLO cuando pregunten la hora o fecha actual de algún lugar específico
- getWeather: usar SOLO cuando pregunten por el clima o temperatura de algún lugar
- searchWeb: usar SOLO cuando necesites información actualizada como noticias, precios, eventos, personas, ganadores de competencias recientes, resultados deportivos, o cualquier hecho que pueda haber cambiado en los últimos años

REGLAS ANTI-ALUCINACIÓN:
- NUNCA inventes la hora. Si preguntan la hora usa getTime SIEMPRE
- NUNCA inventes el clima. Si preguntan el clima usa getWeather SIEMPRE
- NUNCA inventes noticias o precios. Si necesitas datos actuales usa searchWeb SIEMPRE
- NUNCA inventes ganadores de competencias, premios o resultados deportivos recientes. Usa searchWeb SIEMPRE
- Si no sabes algo y no tienes una tool apropiada di honestamente que no tienes esa información
- NUNCA uses el historial para responder preguntas de hora, clima o precios — SIEMPRE llama la tool de nuevo
- NUNCA inventes quién ocupa un cargo político actualmente. Usa searchWeb SIEMPRE para presidentes, ministros, directores o cualquier cargo que pueda haber cambiado

REGLAS DE COMPORTAMIENTO:
- Para saludos preguntas generales o conversación responde directamente SIN usar tools
- Si el usuario dice "Y en X" o "Y en X país" después de preguntar hora o clima — interpreta que sigue preguntando lo mismo pero para ese lugar
- Si el usuario pide el mismo dato de nuevo SIEMPRE vuelve a llamar la tool para datos frescos
- Si una tool falla informa al usuario que no pudiste obtener esa información
- Nunca respondas con texto vacío
`.trim();
  private readonly TTL = 86400;

  constructor(private config: ConfigService) {
    this.model = new ChatGoogleGenerativeAI({
      apiKey: this.config.get<string>('GEMINI_API_KEY'),
      model: 'gemini-2.5-flash-lite',
      temperature: 0,
    });

    // 1. Crear las tools
    this.tools = [
      getTimeTool,
      createGetWeatherTool(
        this.config.get<string>('OPENWEATHER_API_KEY') as string,
      ),
      createSearchWebTool(
        this.config.get<string>('SERPER_API_KEY') as string,
      ),
    ];

    // Log para verificar
    console.log('Tools registradas:', this.tools.map(t => t.name));

    // 2. Vincular tools al modelo
    this.modelWithTools = this.model.bindTools(this.tools);

    // 2. Vincular tools al modelo
    /**  this.modelWithTools = this.model.bindTools(this.tools, {
       tool_choice: 'auto',
     });*/

    this.redisClient = new Redis(
      this.config.get<string>('REDIS_URL') as string,
    );
  }

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
    // Obtener historial desde Redis
    const chatHistory = this.getHistory(chatId);
    let history: BaseMessage[] = await chatHistory.getMessages();

    // Filtrar solo mensajes de texto puro — evita tool_calls corruptos en el historial
    history = history.filter(
      msg => typeof msg.content === 'string' && msg.content.trim() !== '',
    );

    // Limitar a últimos 10 mensajes para evitar contexto contaminado
    if (history.length > 20) {
      history = history.slice(-20);
    }

    // Construir mensajes: sistema + historial + pregunta actual
    const messages: BaseMessage[] = [
      new SystemMessage(this.SYSTEM_PROMPT),
      ...history,
      new HumanMessage(userMessage),
    ];

    try {
      // Primera llamada — modelo decide si necesita tools
      const response = await this.modelWithTools.invoke(messages);

      if (response.tool_calls && response.tool_calls.length > 0) {

        // Ejecutar cada tool solicitada en paralelo
        const toolMessages: ToolMessage[] = await Promise.all(
          response.tool_calls.map(async (toolCall) => {
            const toolToUse = this.tools.find(t => t.name === toolCall.name);

            if (!toolToUse) {
              return new ToolMessage({
                content: `Tool "${toolCall.name}" no encontrada.`,
                tool_call_id: toolCall.id,
              });
            }

            try {
              const toolResult = await toolToUse.invoke(toolCall.args);
              return new ToolMessage({
                content: String(toolResult),
                tool_call_id: toolCall.id,
              });
            } catch {
              return new ToolMessage({
                content: `No pude obtener la información de "${toolCall.name}".`,
                tool_call_id: toolCall.id,
              });
            }
          }),
        );

        // Inyectar resultados directamente en el SystemMessage
        // evita que el modelo ignore los ToolMessages
        const toolResultsSummary = toolMessages
          .map(tm => `- ${String(tm.content)}`)
          .join('\n');

        // Segunda llamada — SIN historial, SIN tools
        // Solo formula respuesta con los resultados obtenidos
        const finalResponse = await this.model.invoke([
          new SystemMessage(`
Eres un asistente útil. Responde siempre en español de forma concisa.

INFORMACIÓN OBTENIDA DE LAS HERRAMIENTAS:
${toolResultsSummary}

INSTRUCCIONES:
- Usa EXACTAMENTE la información de arriba para responder
- PROHIBIDO decir que no tienes acceso a datos en tiempo real
- PROHIBIDO recomendar fuentes externas si ya tienes la información
- PROHIBIDO ignorar los datos proporcionados
- Si la información es insuficiente dilo honestamente
        `.trim()),
          new HumanMessage(userMessage),
        ]);

        const aiResponse = finalResponse.content as string;

        if (!aiResponse || aiResponse.trim() === '') {
          return 'No pude generar una respuesta. Intenta de nuevo.';
        }

        // Guardar solo texto puro en Redis — sin tool_calls
        await chatHistory.addUserMessage(userMessage);
        await chatHistory.addAIMessage(aiResponse);
        return aiResponse;
      }

      // Sin tools — respuesta directa con historial completo
      const aiResponse = response.content as string;

      if (!aiResponse || aiResponse.trim() === '') {
        return 'No pude generar una respuesta. Intenta de nuevo.';
      }

      await chatHistory.addUserMessage(userMessage);
      await chatHistory.addAIMessage(aiResponse);
      return aiResponse;

    } catch (error) {
      // Si Groq falla al generar tool call → reintentar sin tools
      if (error.message?.includes('tool_use_failed')) {
        console.log('Reintentando sin tools...');
        try {
          const retryResponse = await this.model.invoke(messages);
          const aiResponse = retryResponse.content as string;
          if (!aiResponse || aiResponse.trim() === '') {
            return 'No pude generar una respuesta. Intenta de nuevo.';
          }
          await chatHistory.addUserMessage(userMessage);
          await chatHistory.addAIMessage(aiResponse);
          return aiResponse;
        } catch {
          return 'Hubo un error procesando tu mensaje. Por favor intenta de nuevo.';
        }
      }
      console.error('Error en chat:', error.message);
      return 'Hubo un error procesando tu mensaje. Por favor intenta de nuevo.';
    }
  }

  // Método para limpiar el historial de un chat específico
  async clearHistory(chatId: number): Promise<void> {
    const chatHistory = this.getHistory(chatId);
    await chatHistory.clear();
  }
}