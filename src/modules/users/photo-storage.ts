import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Public path photos are served under; stored on the user as-is. */
export const UPLOADS_ROUTE = '/uploads';
const AVATARS = 'avatars';

export const MAX_PHOTO_MB = 5;

/** Image types accepted, told apart by their first bytes, not the file name. */
export function photoExtension(bytes: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/**
 * Profile photos on the server's disk, for development and a single server.
 * Production will move them to object storage; callers only see paths.
 */
export class PhotoStorage {
  constructor(private readonly root: string) {}

  /** Saves [bytes] under a fresh name and returns its public path. */
  async saveAvatar(bytes: Buffer, extension: string): Promise<string> {
    const folder = path.join(this.root, AVATARS);
    await mkdir(folder, { recursive: true });
    const name = `${randomUUID()}.${extension}`;
    await writeFile(path.join(folder, name), bytes);
    return `${UPLOADS_ROUTE}/${AVATARS}/${name}`;
  }

  /** Removes a photo saved here; anything else (an old outside URL) is left alone. */
  async remove(publicPath: string | null | undefined): Promise<void> {
    const prefix = `${UPLOADS_ROUTE}/${AVATARS}/`;
    if (!publicPath?.startsWith(prefix)) return;
    const name = path.basename(publicPath);
    try {
      await unlink(path.join(this.root, AVATARS, name));
    } catch {
      // Already gone: nothing to do.
    }
  }
}
