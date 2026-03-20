import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import axios from 'axios';

// Tipado de la respuesta de OpenWeatherMap
interface WeatherResponse {
  name: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{
    description: string;
  }>;
  wind: {
    speed: number;
  };
}

export const createGetWeatherTool = (apiKey: string) =>
  tool(
    async ({ city }) => {
      try {
        const response = await axios.get<WeatherResponse>(
          'https://api.openweathermap.org/data/2.5/weather',
          {
            params: {
              q: city,
              appid: apiKey,
              units: 'metric',  // Celsius
              lang: 'es',       // descripciones en español
            },
          },
        );

        const { name, main, weather, wind } = response.data;
        // Log temporal para ver qué devuelve OpenWeatherMap
        console.log('Weather resultado:', JSON.stringify({ name, main, weather, wind }));


        return (
          `Clima en ${name}:\n` +
          `🌡️ Temperatura: ${main.temp}°C (sensación: ${main.feels_like}°C)\n` +
          `🌤️ Condición: ${weather[0].description}\n` +
          `💧 Humedad: ${main.humidity}%\n` +
          `💨 Viento: ${wind.speed} m/s`
        );
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return `No encontré información del clima para "${city}". ¿Puedes verificar el nombre de la ciudad?`;
        }
        return `No pude obtener el clima de "${city}" en este momento.`;
      }
    },
    {
      name: 'getWeather',
      description:
        'Obtiene el clima actual de cualquier ciudad del mundo. ' +
        'Úsala cuando el usuario pregunte por el clima, temperatura, ' +
        'lluvia, o condiciones meteorológicas de algún lugar.',
      schema: z.object({
        city: z
          .string()
          .describe('El nombre de la ciudad. Ejemplo: Cucuta, Bogota, Madrid'),
      }),
    },
  );