import axios from 'axios';
import { tool } from '@langchain/core/tools';

export const resendEmailTool = tool(
  async (paymentId: string) => {
    const res = await axios.post(
      `${process.env.AGENT_API_URL}/support/payments/${paymentId}/resend-email`,
      {},
      {
        headers: {
          Authorization: `Bearer ${process.env.AGENT_API_KEY}`,
        },
      },
    );

    console.log("📩 RESEND EMAIL:", paymentId);

    return JSON.stringify({
      success: true,
      message: "Correo reenviado correctamente",
      data: res.data,
    });
  },
  {
    name: "resend_email",
    description: `
Usa esta herramienta cuando el usuario quiera:
- reenviar tickets
- enviar boletas al correo
- recuperar sus entradas

Input: paymentId
`,
  }
);