import { Serper } from '@langchain/community/tools/serper';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const createSearchWebTool = (apiKey: string) =>
  tool(
    async ({ query, type, context }) => {
      try {
        // Helper para ejecutar búsqueda
        const search = async (q: string, useNews = false): Promise<string> => {
          const searcher = new Serper(apiKey, {
            hl: 'es',
            ...(useNews && { type: 'news' }),
          });
          return (await searcher._call(q)) || '';
        };

        const isValid = (result: string): boolean =>
          result.length >= 20 &&
          !result.includes('No good search result');

        // Intento 1 — query tal como el modelo la generó
        console.log(`Serper [intento 1] query:`, query);
        const result1 = await search(query, type === 'news');

        if (isValid(result1)) {
          console.log('Serper result:', result1);
          return `Información sobre "${query}":\n${result1}`;
        }

        // Intento 2 — agregar contexto adicional si el modelo lo proveyó
        const query2 = context ? `${query} ${context}` : `${query} ${new Date().getFullYear()}`;
        console.log(`Serper [intento 2] query:`, query2);
        const result2 = await search(query2);

        if (isValid(result2)) {
          console.log('Serper result:', result2);
          return `Información sobre "${query}":\n${result2}`;
        }

        // Intento 3 — query simplificada
        const query3 = query.split(' ').slice(0, 4).join(' ');
        console.log(`Serper [intento 3] query:`, query3);
        const result3 = await search(query3, true);

        if (isValid(result3)) {
          console.log('Serper result:', result3);
          return `Información sobre "${query}":\n${result3}`;
        }

        return `No encontré información sobre "${query}". Intenta ser más específico.`;

      } catch {
        return `No pude buscar "${query}" en este momento.`;
      }
    },
    {
      name: 'searchWeb',
      description:
        'Busca información actualizada en internet sobre CUALQUIER tema: ' +
        'noticias, economía, política, medicina, tecnología, ciencia, ' +
        'deportes, cultura, precios, personas, empresas, países, ' +
        'o cualquier información que pueda haber cambiado recientemente. ' +
        'NO usar para clima ni hora — esas tienen herramientas dedicadas. ' +
        'En el campo "query" escribe la búsqueda más específica posible. ' +
        'En el campo "context" agrega contexto extra si es necesario (país, año, idioma). ' +
        'Usa type="news" para noticias recientes, type="search" para todo lo demás.',
      schema: z.object({
        query: z.string(),
        type: z.enum(['search', 'news']).default('search'),
        context: z.string().optional(),
      }),
    },
  );