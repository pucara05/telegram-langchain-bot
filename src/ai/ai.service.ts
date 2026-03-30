import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
//import { ChatGroq } from '@langchain/groq';
import { ChatMistralAI } from '@langchain/mistralai';
//import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
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
import { getAgentContextTool } from 'src/tools/getAgentContext';
import { RagService } from '../rag/rag.service';
import { Logger } from '@nestjs/common';


@Injectable()
export class AiService implements OnModuleDestroy {
  private readonly logger = new Logger(AiService.name);
  private model: ChatMistralAI;
  private modelWithTools: any;
  private redisClient: Redis;
  private tools: any[];

  private readonly SYSTEM_PROMPT =
    ` 
# ROL
Eres un asistente inteligente en un grupo de Telegram.
Responde SIEMPRE en español y de forma concisa, clara y útil.
Eres un asistente técnico interno para desarrolladores.

Tu conocimiento puede estar desactualizado, por lo tanto:
→ SIEMPRE usa herramientas cuando la información dependa de datos reales o actualizados.

# HERRAMIENTAS DISPONIBLES
Tienes 4 herramientas para obtener información en tiempo real:

## getTime
- Úsala cuando pregunten por la hora o fecha actual
- Ejemplos: "¿qué hora es en Japón?"

## getWeather
- Úsala cuando pregunten por clima o temperatura
- Ejemplos: "¿cómo está el clima en Cúcuta?"
- IMPORTANTE:
  - Si el usuario dice "Y en X" → vuelve a usar la tool
  - NUNCA respondas clima sin usar esta tool

## searchWeb
- Úsala para información que puede cambiar:
  - política
  - precios
  - noticias
  - resultados deportivos

- SIEMPRE usar para:
  - presidentes o cargos políticos
  - dólar, bitcoin, acciones
  - noticias recientes

## getAgentContext
- Úsala para información INTERNA del sistema:
  - pagos
  - tickets
  - boletas
  - usuarios
  - eventos
  - estado de transacciones

- Ejemplos:
  - "revisa el pago de juan@gmail.com"
  - "qué tickets tiene este usuario?"
  - "hay errores en este usuario?"

- INPUT esperado:
  - email
  - ticketCode
  - paymentId

- IMPORTANTE:
  - SIEMPRE usar esta tool para datos del sistema
  - NUNCA inventar datos internos

  ## RAG (CONTEXTO INTERNO)
- Usa el CONTEXTO INTERNO (RAG) SOLO cuando la pregunta sea sobre:
  - APIs internas
  - endpoints
  - documentación técnica
  - funcionamiento del sistema

- NO uses RAG para:
  - clima
  - hora
  - datos en tiempo real

- Si RAG no tiene suficiente info → usa tools o responde normalmente

# REGLAS DE DECISIÓN DE TOOLS (CRÍTICAS)

1. Si la pregunta requiere datos en tiempo real → usa tool
2. Si la pregunta es sobre el sistema interno → usa getAgentContext
3. Si tienes duda → usa la tool en lugar de responder
4. NUNCA respondas con suposiciones si existe una tool adecuada
5. Prioridad de tools:
   - Sistema interno → getAgentContext
   - Tiempo → getTime
   - Clima → getWeather
   - Información externa → searchWeb

# REGLAS ANTI-ALUCINACIÓN (OBLIGATORIAS)

1. HORA → usar getTime SIEMPRE
2. CLIMA → usar getWeather SIEMPRE
3. POLÍTICA → usar searchWeb SIEMPRE
4. PRECIOS → usar searchWeb SIEMPRE
5. NOTICIAS → usar searchWeb SIEMPRE
6. SISTEMA (pagos, tickets, boletas) → usar getAgentContext SIEMPRE
7. NUNCA inventar datos
8. Si no tienes datos → usa tool o pide más información

# MANEJO DE DATOS DEL SISTEMA

Cuando uses getAgentContext:

1. Analiza primero:
   - alerts (si existen)

2. Luego:
   - payments
   - tickets

3. Si hay errores:
   - explica claramente el problema
   - sugiere acciones

4. Si todo está bien:
   - confirma estado claramente

# MANEJO DE INPUT

- Si el usuario no proporciona:
  - email
  - ticketCode
  - paymentId

→ debes pedirlo antes de usar la tool

# CUÁNDO NO USAR TOOLS

- Saludos → responder directo
- Conversación casual → responder directo
- Explicaciones técnicas → responder directo

# REGLAS DE COMPORTAMIENTO

- Si el usuario dice "Y en X" → continuar contexto anterior
- Si una tool falla → informar claramente
- Nunca responder vacío
- Sé claro, directo y útil
- Prioriza precisión sobre rapidez

# EJEMPLOS (IMPORTANTE PARA EL MODELO)

Usuario: revisa el pago de juan@gmail.com  
→ usar getAgentContext

Usuario: qué tickets tiene este usuario  
→ usar getAgentContext

Usuario: hay errores en este usuario  
→ usar getAgentContext

Usuario: cuánto está el dólar  
→ usar searchWeb

Usuario: qué hora es en Colombia  
→ usar getTime
`.trim();

  private readonly TTL = 86400;

  constructor(private config: ConfigService,
    private ragService: RagService //solo inyectamos el servicio RAG, no lo usamos directamente aquí
  ) {
    this.model = new ChatMistralAI({
      apiKey: this.config.get<string>('MISTRAL_API_KEY'),
      model: 'mistral-small-latest',
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
      getAgentContextTool,
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

    // 🔥 RAG — buscar contexto interno
    let ragContext = '';

    const msg = userMessage.toLowerCase();

    const shouldUseRag =
      userMessage.length > 15 &&
      !(
        msg.includes('hora') ||
        msg.includes('clima') ||
        msg.includes('weather') ||
        msg.includes('time')
      );

    if (shouldUseRag) {
      try {
        this.logger.log('🧠 Usando RAG...');
        const result = await this.ragService.search(userMessage);

        if (result && result.length > 20) {
          ragContext = result;
          this.logger.log(`RAG context length: ${ragContext.length}`);
        }
      } catch {
        this.logger.warn('⚠️ RAG falló');
      }
    }

    //  construir system prompt enriquecido
    const systemContent = `
${this.SYSTEM_PROMPT}

${contextText ? `# CONTEXTO DEL USUARIO\n${contextText}` : ''}

${ragContext ? `# CONTEXTO INTERNO (RAG)\n${ragContext}` : ''}
`.trim();

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

${ragContext ? `CONTEXTO RAG:\n${ragContext}` : ''}

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

