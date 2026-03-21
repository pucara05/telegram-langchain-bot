import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  TELEGRAM_BOT_TOKEN: Joi.string().required(),
  GROQ_API_KEY: Joi.string().required(),
  NGROK_URL: Joi.string().uri().required(),
  PORT: Joi.number().default(3000),
  REDIS_URL: Joi.string().uri().required(),
  OPENWEATHER_API_KEY: Joi.string().required(),
  SERPER_API_KEY: Joi.string().required(),
  MISTRAL_API_KEY: Joi.string().required(),
  GEMINI_API_KEY: Joi.string().required(),
}); 