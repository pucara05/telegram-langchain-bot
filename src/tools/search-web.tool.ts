import { Serper } from '@langchain/community/tools/serper';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const createSearchWebTool = (apiKey: string) =>
  tool(
    async ({ query, type }) => {
      try {
        // Para news NO agregar fecha — Serper ya filtra por reciente
        // Para search de cargos políticos agregar año actual
        const currentYear = new Date().getFullYear();
        const enrichedQuery = type === 'search' &&
          (query.toLowerCase().includes('presidente') ||
           query.toLowerCase().includes('ministro') ||
           query.toLowerCase().includes('director') ||
           query.toLowerCase().includes('quien es'))
          ? `${query} ${currentYear}`
          : query;

        const search = new Serper(apiKey, {
          hl: 'es',
          ...(type === 'news' && { type: 'news' }),
        });

        console.log(`Serper [${type}] query:`, enrichedQuery);
        const result = await search._call(enrichedQuery);

        // Fallback si resultado es muy corto o vacío
        if (!result || result.length < 20 || result.includes('No good search result')) {
          console.log('Resultado insuficiente, reintentando con query refinada...');
          const retrySearch = new Serper(apiKey, { hl: 'es' });
          const retryQuery = type === 'news'
            ? `${query} últimas noticias`
            : `${query} ${currentYear}`;
          const retryResult = await retrySearch._call(retryQuery);

          if (!retryResult || retryResult.length < 20) {
            return `No encontré información actualizada sobre "${query}".`;
          }

          console.log('Serper retry result:', retryResult);
          // Formatear resultado para que el modelo lo entienda mejor
          return `Información encontrada sobre "${query}":\n${retryResult}`;
        }

        console.log('Serper result:', result);
        // Formatear resultado para que el modelo lo entienda mejor
        return `Información encontrada sobre "${query}":\n${result}`;

      } catch {
        return `No pude buscar "${query}" en este momento.`;
      }
    },
    {
      name: 'searchWeb',
      description:
        'Busca información actualizada en internet usando Google. ' +
        'Úsala para: noticias recientes, eventos actuales, precios, ' +
        'cargos políticos actuales como presidentes ministros o directores, ' +
        'deportes, tecnología, personas públicas, ' +
        'o cualquier información que pueda haber cambiado recientemente. ' +
        'NO usar para clima ni hora — esas tienen herramientas dedicadas. ' +
        'Usa type="news" para noticias recientes, type="search" para todo lo demás.',
      schema: z.object({
        query: z.string(),
        type: z.enum(['search', 'news']).default('search'),
      }),
    },
  );