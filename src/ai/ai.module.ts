import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { RagModule } from '../rag/rag.module';

@Module({
  providers: [AiService],
  exports: [AiService],
  imports: [RagModule],
})
export class AiModule { }
