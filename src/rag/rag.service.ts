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


      // 🔥 TU CHUNKING BASE (NO SE TOCA)
      const sections = text.split('\n## ');

      const rawChunks = sections.map((section, index) => {
        return (index === 0 ? section : '## ' + section).trim();
      });

      // 🔥 🔥 FIX REAL: MERGE DE CHUNKS PEQUEÑOS
      const mergedChunks: string[] = [];

      for (let i = 0; i < rawChunks.length; i++) {
        let current = rawChunks[i];

        // si el chunk es pequeño → unir con el siguiente
        if (current.length < 400 && i + 1 < rawChunks.length) {
          current += '\n' + rawChunks[i + 1];
          i++;
        }

        mergedChunks.push(current);
      }

      // chunks filtrados (eliminar ruido y chunks irrelevantes)
      const docs = mergedChunks
        .filter(chunk => {
          const text = chunk.toLowerCase();

          return (
            chunk.length > 100 &&

            // ❌ eliminar ruido
            !text.includes('tabla de contenidos') &&
            !text.includes('documentación') &&
            !text.includes('versión:') &&
            !text.includes('módulo:') &&

            // ❌ evitar índices
            !text.match(/^\d+\.\s/) &&

            // ❌ evitar títulos sueltos
            !text.trim().startsWith('#')
          );
        })
        .map(chunk => ({
          pageContent: chunk,
          metadata: { source: 'AGENT_API.md' },
        }));
      this.logger.log(`📄 Total chunks generados: ${docs.length}`);

      // 🧠 modelo embeddings (NO SE TOCA)
      this.logger.log('⬇️ Cargando modelo embeddings...');
      this.extractor = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      );

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

      this.vectorStore = new Chroma(embeddings as any, {
        collectionName: 'agent_docs',
        url: 'http://localhost:8000',
      });

      // 🔥 ✅ SOLUCIÓN REAL (SIN ROMPER NADA)
      const existing = await this.vectorStore.similaritySearch('agent', 1);

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
        k: 6, // 🔥 NO SE TOCA
      });

      const results = await retriever.invoke(query);

      // 🔥 DEBUG (NO SE TOCA)
      this.logger.log(
        `📦 RAG chunks encontrados:\n${results
          .map((r, i) => `\n--- CHUNK ${i + 1} ---\n${r.pageContent}`)
          .join('\n')}`,
      );

      return results.map(doc => doc.pageContent).join('\n\n');
    } catch (error) {
      this.logger.warn('⚠️ Error en RAG');
      return '';
    }
  }

  private async embed(text: string): Promise<number[]> {
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }
}