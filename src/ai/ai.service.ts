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
import { resendEmailTool } from 'src/tools/resend-email.tool';


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
Eres un asistente de soporte técnico de GoBoleta (venta de boletas en Colombia).

Respondes SIEMPRE:
- en español colombiano
- de forma clara, profesional y concisa
- SIN frases de espera (ej: "voy a consultar", "un momento")

Tu objetivo es ayudar usando:
- tools
- contexto del sistema (Agent API)
- documentación interna (RAG)

---

# 🧠 PRIORIDAD DE DATOS (CRÍTICO)

SIEMPRE usa este orden:

1. 🔥 getAgentContext (datos reales del sistema)
2. 🔥 tools (tiempo real)
3. 🔥 RAG (documentación técnica)
4. ❌ conocimiento propio (solo si no hay contexto)

---

# 🛠️ USO DE TOOLS

## getAgentContext (MÁS IMPORTANTE)
Usar SIEMPRE para:
- pagos
- tickets
- boletas
- usuarios
- eventos

INPUT:
- email
- paymentId
- ticketCode

REGLAS:
- NUNCA inventes datos
- Si falta input → pedirlo

---

## getTime
→ hora/fecha

## getWeather
→ clima

## searchWeb
→ noticias, precios, política

---

## resend_email
→ reenviar correo de tickets

Usar cuando el usuario diga:
- reenviar correo
- enviar boletas
- no me llegaron los tickets
- reenviar email

INPUT:
- paymentId

IMPORTANTE:
- Esta acción ejecuta un endpoint real (/support)
- No confirmar éxito si la tool falla



# 🧠 USO DE RAG (CRÍTICO)

Usar SOLO para:
- endpoints
- APIs
- documentación técnica
- arquitectura del sistema
- acciones sugeridas

---

# 🔥 REGLA CRÍTICA (FIX PRINCIPAL)

- La documentación (RAG) es una fuente válida SIEMPRE
- NO necesitas getAgentContext para responder preguntas de documentación

DIFERENCIA CLAVE:
- getAgentContext → datos reales de un usuario
- RAG → documentación del sistema



---

# ⚠️ REGLAS OBLIGATORIAS DE RAG

- SI hay CONTEXTO RAG:
  → DEBES usarlo obligatoriamente

- PROHIBIDO decir "no está documentado"
  SI la información aparece en el contexto RAG

- PROHIBIDO ignorar el contexto RAG

- NO confundir:
  - documentación (RAG) ✅
  - datos en tiempo real (tools) ✅

---

# 🚨 REGLAS ANTI-ALUCINACIÓN (OBLIGATORIAS)

- NUNCA inventar endpoints
- NUNCA inventar datos
- NUNCA asumir información

- Si la información NO está en:
  - RAG
  - tools
  - getAgentContext

→ entonces sí puedes decir:
"No está documentado en el sistema"

---

# 📊 MANEJO DEL CONTEXTO (CLAVE)

Cuando uses getAgentContext:

## 1. LEER alerts PRIMERO (CRÍTICO)
- Son problemas automáticos
- SI existen → SON PRIORIDAD

## 2. LEER suggestedActions
- Son acciones reales del backend
- NO inventar acciones

## 3. USAR buyer
- Personalizar si existe

## 4. ANALIZAR:
- payments
- tickets
- events

---

# 🧠 REGLAS DE NEGOCIO

- payment = pending
  → informar + sugerir verificación

- payment = approved + tickets = 0
  → problema → sugerir regeneración

- payment con errorDetail
  → explicar error + escalar

- alerts presentes
  → SIEMPRE explicarlos primero

- todo correcto
  → confirmar claramente

---

# 🔧 ENDPOINTS (IMPORTANTE)

- /agent/* → SOLO consulta (lectura)
- /support/* → acciones reales

REGLAS:
- NUNCA inventar endpoints
- NUNCA cambiar nombres de endpoints
- SI no está en RAG → no existe

---

# 🚫 PROHIBIDO DECIR

- "voy a consultar"
- "un momento"
- "déjame revisar"

👉 YA tienes el contexto disponible

---

# 🧠 COMPORTAMIENTO

- Responde directo
- Prioriza precisión sobre rapidez
- Usa listas claras (NO tablas con "|")

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
      resendEmailTool,
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

    // 🔥 EXECUCIÓN DIRECTA DE ACCIONES (FIX REAL)

    // detectar intención de resend
    const isResendIntent =
      msg.includes('reenviar') ||
      msg.includes('correo') ||
      msg.includes('email');

    // detectar paymentId (UUID)
    const paymentIdMatch = userMessage.match(
      /[0-9a-fA-F-]{36}/
    );

    if (isResendIntent && paymentIdMatch) {
      const paymentId = paymentIdMatch[0];

      this.logger.log(`📩 Ejecutando resend_email: ${paymentId}`);

      try {
        const result = await resendEmailTool.invoke(paymentId);

        return `✅ Correo reenviado correctamente para el pago ${paymentId}`;
      } catch (error) {
        return `❌ No se pudo reenviar el correo para el pago ${paymentId}`;
      }
    }
    // 🔥 keywords RAG (documentación interna)
    const ragKeywords = [
      'endpoint',
      'endpoints',
      'api',
      'agent',
      'support',
      'soporte',
      'acciones',
      'alertas',
      'sistema',
      'flujo',
      'context',
      'documentación',
      'tickets',
      'pagos',
    ];

    // 🔥 queries de tools (EXCLUIR RAG)
    const toolKeywords = [
      'hora',
      'time',
      'clima',
      'weather',
      'temperatura',
      'dólar',
      'precio',
      'bitcoin',
    ];

    // 🔥 detectar acciones (CRÍTICO)
    const actionKeywords = [
      'reenviar',
      'enviar',
      'correo',
      'email',
      'tickets',
      'resend',
    ];

    const isActionQuery = actionKeywords.some(k => msg.includes(k));

    // 🔥 tools externas
    const isToolQuery = toolKeywords.some(k => msg.includes(k));

    // 🔥 RAG
    const isRagQuery = ragKeywords.some(k => msg.includes(k));

    // 🔥 DECISIÓN FINAL (FIX REAL)
    const shouldUseRag =
      !isToolQuery &&
      !isActionQuery && // 🔥 ESTO ES LA CLAVE
      isRagQuery;

    // 🔥 log para debug
    this.logger.log(`RAG usado: ${shouldUseRag}`);

    if (shouldUseRag) {
      try {
        this.logger.log('🧠 Usando RAG...');

        const result = await this.ragService.search(userMessage);

        // 🔥 validación de contexto
        if (result && result.trim().length > 30) {
          ragContext = result;
          this.logger.log(`RAG context length: ${ragContext.length}`);
        } else {
          this.logger.warn('⚠️ RAG sin contexto útil');
        }
      } catch (error) {
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
          new SystemMessage(systemContent),

          new HumanMessage(`
PREGUNTA DEL USUARIO:
${userMessage}

${toolResultsSummary ? `INFORMACIÓN DE TOOLS:\n${toolResultsSummary}` : ''}

INSTRUCCIONES:
- Usa SOLO la información proporcionada (RAG + tools)
- NO inventes endpoints
- NO inventes datos
- Si no está en el contexto → dilo claramente

REGLAS CRÍTICAS DE RESPUESTA:
- Si el contexto contiene listas, tablas o endpoints → debes devolver TODOS los elementos
- NO resumir información técnica
- NO omitir endpoints
- NO reducir tablas
- Si hay múltiples endpoints → listarlos TODOS
- Mantener estructura clara (tabla o lista)

⚠️ REGLAS CRÍTICAS DE RAG (FIX DEL BUG):
- Si la información aparece en el CONTEXTO RAG → DEBES usarla
- PROHIBIDO decir "no está documentado" si sí aparece en el contexto
- NO confundir:
  - documentación (RAG) ✅
  - datos en tiempo real (tools) ✅
- Si la pregunta es sobre:
  - acciones
  - endpoints
  - sistema
  → responder SIEMPRE con el RAG

FORMATO DE RESPUESTA:
- NO usar tablas con "|"
- Usar listas con viñetas o saltos de línea
- Hacer la respuesta clara y legible para humanos

`.trim()),
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
      const finalResponse = await this.model.invoke([
        new SystemMessage(systemContent),
        new HumanMessage(`
PREGUNTA DEL USUARIO:
${userMessage}

INSTRUCCIONES:
- Usa el contexto disponible (RAG si existe)
- No inventes información
- Si no sabes algo, dilo claramente
  `.trim()),
      ]);

      const aiResponse = finalResponse.content as string;

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

