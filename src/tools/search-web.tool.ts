import { Serper } from '@langchain/community/tools/serper';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const createSearchWebTool = (apiKey: string) =>
  tool(
    async ({ query }) => {
      try {
        const search = new Serper(apiKey, {
          hl: 'es', // respuestas en español
          // sin gl → búsqueda global, no limitada a Colombia
        });
        const result = await search._call(query);
        console.log('Serper result:', result);
        return result;
      } catch {
        return `No pude buscar "${query}" en este momento.`;
      }
    },
    {
      name: 'searchWeb',
      description:
        'Busca información actualizada en internet usando Google. ' +
        'Úsala para: noticias recientes, eventos actuales, precios, ' +
        'personas públicas, política, deportes, tecnología, ' +
        'o cualquier información que pueda haber cambiado recientemente. ' +
        'NO usar para clima ni hora — esas tienen herramientas dedicadas.',
      schema: z.object({
        query: z.string(),
      }),
    },
  );