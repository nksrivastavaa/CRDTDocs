import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DatabaseService } from '@collab/common';
import * as Y from 'yjs';

interface DocumentStateRow {
  ydoc_state: Buffer | null;
}

@Injectable()
export class DocumentSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentSessionService.name);
  private readonly docs = new Map<string, Y.Doc>();
  private readonly flushTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly db: DatabaseService) {}

  async getDocument(documentId: string): Promise<Y.Doc> {
    const existing = this.docs.get(documentId);

    if (existing) {
      return existing;
    }

    const doc = new Y.Doc();
    const row = await this.db.one<DocumentStateRow>(
      `
        SELECT ydoc_state
        FROM documents
        WHERE id = $1
          AND is_deleted = false
      `,
      [documentId],
    );

    if (row?.ydoc_state && row.ydoc_state.length > 0) {
      Y.applyUpdate(doc, new Uint8Array(row.ydoc_state));
    }

    this.docs.set(documentId, doc);
    return doc;
  }

  async encodeState(documentId: string): Promise<Uint8Array> {
    const doc = await this.getDocument(documentId);
    return Y.encodeStateAsUpdate(doc);
  }

  async applyUpdate(documentId: string, update: Uint8Array): Promise<void> {
    const doc = await this.getDocument(documentId);
    Y.applyUpdate(doc, update);
    this.scheduleFlush(documentId);
  }

  private scheduleFlush(documentId: string): void {
    const existing = this.flushTimers.get(documentId);

    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      void this.flush(documentId);
    }, 1000);

    this.flushTimers.set(documentId, timer);
  }

  private async flush(documentId: string): Promise<void> {
    const timer = this.flushTimers.get(documentId);

    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(documentId);
    }

    const doc = this.docs.get(documentId);

    if (!doc) {
      return;
    }

    try {
      await this.db.query(
        `
          UPDATE documents
          SET ydoc_state = $2, updated_at = now()
          WHERE id = $1
            AND is_deleted = false
        `,
        [documentId, Buffer.from(Y.encodeStateAsUpdate(doc))],
      );
    } catch (error) {
      this.logger.warn(`Failed to persist Yjs state for ${documentId}: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.docs.keys()].map((documentId) => this.flush(documentId)));
  }
}
