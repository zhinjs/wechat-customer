import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

/**
 * Resolve leading `~` in a directory path to the user's home directory.
 */
function resolveDir(dir: string): string {
  if (dir === '~' || dir.startsWith('~/') || dir.startsWith('~\\')) {
    return path.join(os.homedir(), dir.slice(1));
  }
  return dir;
}

export class Storage {
  private dir: string;

  constructor(dir: string) {
    this.dir = resolveDir(dir);
  }

  private keyPath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dir, `${safeKey}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async save(key: string, data: unknown): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.keyPath(key), JSON.stringify(data, null, 2), 'utf-8');
  }

  async load<T>(key: string): Promise<T | null> {
    try {
      const content = await fs.readFile(this.keyPath(key), 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.keyPath(key));
    } catch {
      // ignore if not exists
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.keyPath(key));
      return true;
    } catch {
      return false;
    }
  }
}
