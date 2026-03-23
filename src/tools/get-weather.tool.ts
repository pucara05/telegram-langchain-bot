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
    'Obtiene el clima actual de cualquier ciudad o país del mundo. ' +
    'Úsala SIEMPRE cuando pregunten por clima, temperatura, lluvia, ' +
    'viento o condiciones meteorológicas de cualquier lugar. ' +
    'También úsala cuando el usuario diga "Y en X" después de preguntar el clima de otro lugar.',
  schema: z.object({
    city: z.string(),
  }),
}
  );