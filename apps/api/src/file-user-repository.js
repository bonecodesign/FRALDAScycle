import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class FileUserRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async #readUsers() {
    try {
      const content = await readFile(this.filePath, "utf8");
      const users = JSON.parse(content);

      if (!Array.isArray(users)) {
        throw new Error("User data must be an array");
      }

      return users;
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  async #writeUsers(users) {
    await mkdir(dirname(this.filePath), { recursive: true });

    const temporaryFilePath = `${this.filePath}.tmp`;
    await writeFile(temporaryFilePath, JSON.stringify(users, null, 2), "utf8");
    await rename(temporaryFilePath, this.filePath);
  }

  async findByEmail(email) {
    const users = await this.#readUsers();

    return users.find((user) => user.email === email) ?? null;
  }

  async findById(id) {
    const users = await this.#readUsers();

    return users.find((user) => user.id === id) ?? null;
  }

  async create({ email, passwordHash, passwordSalt }) {
    const users = await this.#readUsers();
    const user = {
      id: randomUUID(),
      email,
      passwordHash,
      passwordSalt,
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    await this.#writeUsers(users);

    return user;
  }
}
