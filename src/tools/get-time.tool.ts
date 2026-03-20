import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const getTimeTool = tool(
  async ({ timezone }) => {
    try {
      const now = new Date().toLocaleString('es-CO', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      return `La fecha y hora actual en ${timezone} es: ${now}`;
    } catch {
      return `No pude obtener la hora para "${timezone}".`;
    }
  },
  {
    name: 'getTime',
    description: 'Obtiene la hora actual de cualquier zona horaria. Usa formato IANA como America/Bogota, Asia/Tokyo, Europe/Madrid.',
    schema: z.object({
      timezone: z.string(),  // ← sin .describe(), más simple
    }),
  },
);