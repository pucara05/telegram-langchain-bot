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
# ROL
Eres un asistente inteligente en un grupo de Telegram.
Responde SIEMPRE en español y de forma concisa y clara.
Tu fecha de conocimiento tiene un límite — para cualquier información que pueda haber cambiado, usa las herramientas disponibles.

# HERRAMIENTAS DISPONIBLES
Tienes 3 herramientas para obtener información en tiempo real:

## getTime
- Úsala cuando pregunten por la hora o fecha actual en cualquier lugar del mundo
- Ejemplos: "¿qué hora es en Japón?", "¿qué día es hoy en Australia?"

## getWeather
## getWeather
- Úsala cuando pregunten por el clima, temperatura, lluvia o condiciones meteorológicas
- Ejemplos: "¿cómo está el clima en Cúcuta?", "¿está lloviendo en Madrid?", "¿qué temperatura hace en Australia?"
- IMPORTANTE: Si el usuario dice "Y en X" después de preguntar clima → llama getWeather para X también
- NUNCA respondas el clima desde tu conocimiento — siempre llama esta tool

## searchWeb
- Úsala para cualquier información que pueda haber cambiado recientemente
- Casos de uso OBLIGATORIOS:
  * Cargos políticos: presidentes, ministros, reyes, primeros ministros de CUALQUIER país del mundo — incluyendo Estados Unidos, Colombia, Venezuela, España o cualquier otro
  * ADVERTENCIA: Los gobiernos cambian frecuentemente. Tu conocimiento de entrenamiento sobre cargos políticos puede estar desactualizado. SIEMPRE busca antes de responder
  * Precios: dólar, bitcoin, acciones, commodities
  * Noticias y eventos recientes
  * Resultados deportivos y ganadores de competencias
  * Cualquier hecho que pueda haber cambiado en los últimos años

# REGLAS ANTI-ALUCINACIÓN (CRÍTICAS)
Estas reglas son ABSOLUTAS y no tienen excepciones:

1. HORA → usa getTime SIEMPRE. NUNCA inventes ni estimes la hora
2. CLIMA → usa getWeather SIEMPRE. NUNCA inventes condiciones meteorológicas
3. CARGOS POLÍTICOS → usa searchWeb SIEMPRE antes de responder. NUNCA uses tu conocimiento de entrenamiento para responder quién ocupa un cargo — tu información puede estar desactualizada
4. PRECIOS → usa searchWeb SIEMPRE. NUNCA inventes precios de divisas, criptomonedas o acciones
5. RESULTADOS DEPORTIVOS → usa searchWeb SIEMPRE. NUNCA inventes ganadores de mundiales, olimpiadas o competencias
6. NOTICIAS → usa searchWeb SIEMPRE. NUNCA inventes eventos recientes
7. HISTORIAL → NUNCA uses el historial para responder preguntas de hora, clima o precios. Llama la tool de nuevo para datos frescos

# CUÁNDO NO USAR TOOLS
- Saludos y conversación general → responde directamente
- Preguntas de conocimiento general estable → responde directamente
- Explicaciones técnicas o conceptuales → responde directamente

# REGLAS DE COMPORTAMIENTO
- Si el usuario dice "Y en X" después de preguntar hora o clima → interpreta que sigue preguntando lo mismo para ese lugar y llama la tool de nuevo
- Si una tool falla → informa al usuario de forma clara que no pudiste obtener esa información
- Si no tienes una tool apropiada para algo → di honestamente que no tienes esa información
- NUNCA respondas con texto vacío
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

    // Limitar a últimos 20 mensajes para evitar contexto contaminado
    if (history.length > 20) {
      history = history.slice(-20);
    }

    // NUEVO — detectar y guardar datos del usuario antes de procesar
    const extractedData = await this.extractUserData(userMessage);
    await this.updateUserContext(chatId, extractedData);

    // NUEVO — obtener contexto del usuario y construir SystemMessage enriquecido
    const rawContext = await this.getUserContext(chatId);
    const userContext = rawContext ? JSON.parse(rawContext) : {};
    const contextText = this.formatContext(userContext);

    const systemContent = contextText
      ? `${this.SYSTEM_PROMPT}\n\n# CONTEXTO DEL USUARIO\n${contextText}`
      : this.SYSTEM_PROMPT;

    // Construir mensajes: sistema enriquecido + historial + pregunta actual
    const messages: BaseMessage[] = [
      new SystemMessage(systemContent),
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
        const toolResultsSummary = toolMessages
          .map(tm => `- ${String(tm.content)}`)
          .join('\n');

        // Segunda llamada — SIN historial, SIN tools
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

  // Limpia solo el historial — conserva contexto del usuario
  async clearHistory(chatId: number): Promise<void> {
    const chatHistory = this.getHistory(chatId);
    await chatHistory.clear();
  }

  // Limpia todo — historial + contexto del usuario
  async clearAll(chatId: number): Promise<void> {
    const chatHistory = this.getHistory(chatId);
    await chatHistory.clear();
    await this.redisClient.del(`context:${chatId}`);
  }

// Obtiene el contexto guardado del usuario desde Redis
private async getUserContext(chatId: number): Promise<string> {
  try {
    const context = await this.redisClient.get(`context:${chatId}`);
    return context || '';
  } catch {
    return '';
  }
}

// Extrae datos del usuario usando IA — más flexible que regex
private async extractUserData(
  message: string,
): Promise<Record<string, string>> {
  try {
    const response = await this.model.invoke([
      new SystemMessage(`
Extrae datos personales del usuario si están explícitos en el mensaje.
Responde SOLO un JSON válido sin explicaciones ni markdown.
Campos posibles: nombre, rol, tecnologias, ubicacion.
Si no hay dato claro para un campo, no lo incluyas.
Si el mensaje no contiene datos personales responde: {}
Ejemplos:
  "hola me llamo Daniel y soy dev backend" → {"nombre":"Daniel","rol":"desarrollador backend"}
  "que hora es en japón" → {}
  "soy médico y vivo en Bogotá" → {"rol":"médico","ubicacion":"Bogotá"}
      `.trim()),
      new HumanMessage(message),
    ]);

    const content = response.content as string;
    const cleaned = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, v]) => typeof v === 'string' && v.trim() !== '',
      ),
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

// Actualiza el contexto del usuario en Redis — mergea con datos existentes
private async updateUserContext(
  chatId: number,
  newData: Record<string, string>,
): Promise<void> {
  if (Object.keys(newData).length === 0) return;
  try {
    const existing = await this.redisClient.get(`context:${chatId}`);
    const currentContext = existing ? JSON.parse(existing) : {};
    const updatedContext = { ...currentContext, ...newData };
    await this.redisClient.set(
      `context:${chatId}`,
      JSON.stringify(updatedContext),
    );
  } catch (error) {
    console.error('Error actualizando contexto:', error.message);
  }
}

// Formatea el contexto como texto legible para inyectar en el SystemMessage
private formatContext(context: Record<string, string>): string {
  if (Object.keys(context).length === 0) return '';
  const lines: string[] = [];
  if (context.nombre) lines.push(`- Nombre: ${context.nombre}`);
  if (context.rol) lines.push(`- Rol: ${context.rol}`);
  if (context.tecnologias) lines.push(`- Tecnologías: ${context.tecnologias}`);
  if (context.ubicacion) lines.push(`- Ubicación: ${context.ubicacion}`);
  return lines.join('\n');
}


}

