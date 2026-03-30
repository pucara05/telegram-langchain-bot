import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from '@xenova/transformers';
import { Chroma } from '@langchain/community/vectorstores/chroma';

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);

  private extractor: any;
  private vectorStore: Chroma;

  async onModuleInit() {
    try {
      this.logger.log('🔥 Inicializando RAG (Chroma + local)...');

      const filePath = path.join(
        process.cwd(),
        'src/rag/documents/AGENT_API.md',
      );

      const text = fs.readFileSync(filePath, 'utf-8');

      //  chunking (igual que tú)
      const docs = text
        .split('\n\n')
        .filter(chunk => chunk.trim().length > 0)
        .map(chunk => ({
          pageContent: chunk,
          metadata: { source: 'AGENT_API.md' },
        }));

      // 🧠 cargar modelo (igual que tú)
      this.logger.log('⬇️ Cargando modelo embeddings...');
      this.extractor = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      );

      //  wrapper embeddings (usa TU lógica interna)
      const embeddings = {
        embedDocuments: async (texts: string[]) => {
          const result: number[][] = [];

          for (const text of texts) {
            const emb = await this.embed(text);
            result.push(emb);
          }

          return result;
        },
        embedQuery: async (text: string) => {
          return this.embed(text);
        },
      };

      //  CHROMA (PRO — NO recalcula siempre)
      this.vectorStore = new Chroma(embeddings as any, {
        collectionName: 'agent_docs',
        url: 'http://localhost:8000',
      });

      //  verificar si ya hay datos
      const existing = await this.vectorStore.similaritySearch('test', 1);

      if (!existing || existing.length === 0) {
        this.logger.log('📥 Insertando documentos en Chroma...');

        await this.vectorStore.addDocuments(docs);

        this.logger.log('✅ Documentos insertados');
      } else {
        this.logger.log('⚡ Chroma ya tiene datos, no se recalcula');
      }

      this.logger.log('✅ RAG listo (Chroma + persistente)');
    } catch (error) {
      this.logger.error('❌ Error inicializando RAG', error);
    }
  }

  async search(query: string): Promise<string> {
    try {
      if (!query || query.length < 5) return '';
      if (!this.vectorStore) return '';

      const retriever = this.vectorStore.asRetriever({
        k: 3,
      });

      const results = await retriever.invoke(query);

      return results.map(doc => doc.pageContent).join('\n\n');
    } catch (error) {
      this.logger.warn('⚠️ Error en RAG');
      return '';
    }
  }

  //  TU MISMA FUNCIÓN (NO SE TOCA)
  private async embed(text: string): Promise<number[]> {
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }
}