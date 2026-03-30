import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from '@xenova/transformers';

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);

  private docs: string[] = [];
  private embeddings: number[][] = [];

  private extractor: any; // modelo transformers

  async onModuleInit() {
    try {
      this.logger.log('🔥 Inicializando RAG (local)...');

      // 📄 cargar archivo
      const filePath = path.join(
        process.cwd(),
        'src/rag/documents/AGENT_API.md',
      );

      const text = fs.readFileSync(filePath, 'utf-8');

      // 🔥 chunking simple
      this.docs = text.split('\n\n').filter(chunk => chunk.trim().length > 0);

      // 🧠 cargar modelo local (SOLO UNA VEZ)
      this.logger.log('⬇️ Cargando modelo embeddings...');
      this.extractor = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      );

      // 🔥 generar embeddings
      this.logger.log('🧠 Generando embeddings...');
      this.embeddings = [];

      for (const doc of this.docs) {
        const embedding = await this.embed(doc);
        this.embeddings.push(embedding);
      }

      this.logger.log('✅ RAG listo (LOCAL sin APIs)');
    } catch (error) {
      this.logger.error('❌ Error inicializando RAG', error);
    }
  }

  async search(query: string): Promise<string> {
    try {
      if (!query || query.length < 5) return '';
      if (!this.extractor) return '';

      const queryEmbedding = await this.embed(query);

      const scores = this.embeddings.map((emb, i) => ({
        index: i,
        score: this.cosineSimilarity(queryEmbedding, emb),
      }));

      const top = scores
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return top.map(t => this.docs[t.index]).join('\n\n');
    } catch (error) {
      this.logger.warn('⚠️ Error en RAG local');
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

  private cosineSimilarity(a: number[], b: number[]) {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    return dot / (magA * magB);
  }
}