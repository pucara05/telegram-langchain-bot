import axios from 'axios';
import { tool } from '@langchain/core/tools';

export const getAgentContextTool = tool(
  async (identifier: string) => {
    const res = await axios.get(
      `${process.env.AGENT_API_URL}/agent/context/${identifier}`,
      
      {
        headers: {
          Authorization: `Bearer ${process.env.AGENT_API_KEY}`,
        },
      }
    );
console.log("🔥 CALLING AGENT API:", identifier);
    return JSON.stringify(res.data);
  },
  {
    name: "get_agent_context",
    description: `
Usa esta herramienta cuando necesites:
- información de pagos
- tickets
- boletas
- eventos
- estado de usuario

El input debe ser email, ticketCode o paymentId
`,
  }
  
);
