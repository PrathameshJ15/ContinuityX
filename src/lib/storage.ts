import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { env } from "@/lib/env";

export interface StorageProvider {
  put(storageKey: string, data: Buffer, mimeType: string): Promise<void>;
  get(storageKey: string): Promise<Buffer>;
  getStream(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.resolve(process.cwd(), "storage", "documents");
  }

  private getFilePath(storageKey: string): string {
    // Sanitize and keep storage within baseDir (prevent path traversal)
    const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
    const parts = normalized.split("/").filter((p) => p && p !== "." && p !== "..");
    if (parts.length === 0) {
      throw new Error("Invalid storage key");
    }
    const target = path.resolve(this.baseDir, ...parts);
    const resolvedBase = path.resolve(this.baseDir);
    if (!target.startsWith(resolvedBase + path.sep) && target !== resolvedBase) {
      throw new Error("Invalid storage key path");
    }
    return target;
  }

  async put(storageKey: string, data: Buffer, _mimeType: string): Promise<void> {
    const filePath = this.getFilePath(storageKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async get(storageKey: string): Promise<Buffer> {
    const filePath = this.getFilePath(storageKey);
    return fs.readFile(filePath);
  }

  async getStream(storageKey: string): Promise<Readable> {
    const filePath = this.getFilePath(storageKey);
    await fs.access(filePath);
    return createReadStream(filePath);
  }

  async delete(storageKey: string): Promise<void> {
    try {
      const filePath = this.getFilePath(storageKey);
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }
}

let storageProviderInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageProviderInstance) {
    if (env.STORAGE_DRIVER === "local") {
      storageProviderInstance = new LocalStorageProvider();
    } else {
      // Production S3/R2 adapter placeholder until credentials are configured
      storageProviderInstance = new LocalStorageProvider();
    }
  }
  return storageProviderInstance;
}
