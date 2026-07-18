import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class FileNotificationRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async #read() {
    try {
      const items = JSON.parse(await readFile(this.filePath, "utf8"));

      if (!Array.isArray(items)) throw new Error("Notification data must be an array");
      return items;
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async #write(items) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(items, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }

  async create({ userId, type, message }) {
    const items = await this.#read();
    const notification = {
      id: randomUUID(),
      userId,
      type,
      message,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    items.unshift(notification);
    await this.#write(items);
    return notification;
  }

  async listByUser(userId) {
    return (await this.#read()).filter((item) => item.userId === userId);
  }
}
