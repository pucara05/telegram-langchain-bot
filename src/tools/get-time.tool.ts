import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Mapa de fallbacks para zonas horarias incompletas o alternativas
const TIMEZONE_FALLBACKS: Record<string, string> = {
  'America/Argentina': 'America/Argentina/Buenos_Aires',
  'America/Indiana': 'America/Indiana/Indianapolis',
  'America/Kentucky': 'America/Kentucky/Louisville',
  'America/North_Dakota': 'America/North_Dakota/Center',
  'Australia/East': 'Australia/Sydney',
  'Australia/West': 'Australia/Perth',
  'Europe/UK': 'Europe/London',
  'Asia/China': 'Asia/Shanghai',
  'Asia/India': 'Asia/Kolkata',
  'Africa/East': 'Africa/Nairobi',
};

// Mapa de países/ciudades comunes a su timezone IANA
const COUNTRY_TO_TIMEZONE: Record<string, string> = {
  'argentina': 'America/Argentina/Buenos_Aires',
  'colombia': 'America/Bogota',
  'venezuela': 'America/Caracas',
  'peru': 'America/Lima',
  'chile': 'America/Santiago',
  'mexico': 'America/Mexico_City',
  'brasil': 'America/Sao_Paulo',
  'brazil': 'America/Sao_Paulo',
  'eeuu': 'America/New_York',
  'usa': 'America/New_York',
  'españa': 'Europe/Madrid',
  'spain': 'Europe/Madrid',
  'francia': 'Europe/Paris',
  'france': 'Europe/Paris',
  'alemania': 'Europe/Berlin',
  'germany': 'Europe/Berlin',
  'japon': 'Asia/Tokyo',
  'japan': 'Asia/Tokyo',
  'china': 'Asia/Shanghai',
  'india': 'Asia/Kolkata',
  'australia': 'Australia/Sydney',
  'rusia': 'Europe/Moscow',
  'russia': 'Europe/Moscow',
  'reino unido': 'Europe/London',
  'uk': 'Europe/London',
  'canada': 'America/Toronto',
};

const getValidTimezone = (timezone: string): string => {
  // 1. Intentar con el timezone exacto
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone; // es válido, usarlo directo
  } catch { /* continuar */ }

  // 2. Buscar en fallbacks exactos
  if (TIMEZONE_FALLBACKS[timezone]) {
    return TIMEZONE_FALLBACKS[timezone];
  }

  // 3. Buscar coincidencia parcial en fallbacks
  const fallbackKey = Object.keys(TIMEZONE_FALLBACKS).find(key =>
    timezone.startsWith(key),
  );
  if (fallbackKey) return TIMEZONE_FALLBACKS[fallbackKey];

  // 4. Buscar en mapa de países
  const normalized = timezone.toLowerCase();
  const countryKey = Object.keys(COUNTRY_TO_TIMEZONE).find(key =>
    normalized.includes(key),
  );
  if (countryKey) return COUNTRY_TO_TIMEZONE[countryKey];

  // 5. No se encontró fallback
  throw new Error(`Zona horaria no reconocida: ${timezone}`);
};

export const getTimeTool = tool(
  async ({ timezone }) => {
    try {
      // Resolver timezone válido con fallbacks
      const validTimezone = getValidTimezone(timezone);

      const now = new Date().toLocaleString('es-CO', {
        timeZone: validTimezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      // Informar si se usó un fallback
      const fallbackNote = validTimezone !== timezone
        ? ` (usando ${validTimezone})`
        : '';

      return `La fecha y hora actual en ${timezone}${fallbackNote} es: ${now}`;
    } catch (error) {
      return (
        `No reconozco la zona horaria "${timezone}". ` +
        `Por favor usa formato IANA como: America/Bogota, Asia/Tokyo, Europe/Madrid, Australia/Sydney.`
      );
    }
  },
  {
    name: 'getTime',
    description:
      'Obtiene la hora actual de cualquier zona horaria del mundo. ' +
      'Usa formato IANA como America/Bogota, Asia/Tokyo, Europe/Madrid. ' +
      'Para Argentina usa America/Argentina/Buenos_Aires. ' +
      'Para Australia usa Australia/Sydney.',
    schema: z.object({
      timezone: z.string(),
    }),
  },
);