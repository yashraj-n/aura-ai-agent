import fs from "fs/promises";
import { glob } from "glob";

class FastIndexer {
  CHUNK_SIZE = 100;
  constructor(private repo_path: string) {
    this.repo_path = repo_path;
  }

  private async index() {
    const files = await glob(this.repo_path + "/**/*");
    let chunks = await Promise.all(
      files.map(async (file) => {
        const content = await fs.readFile(file, "utf-8");
        return {
          file,
          content,
        };
      })
    );
    return chunks;
  }

  public async generateChunks() {
    const chunks = await this.index();
    return chunks.flatMap((c) => {
      const lines = c.content.split("\n");
      return lines.reduce((acc, _, i) => {
        if (i % this.CHUNK_SIZE === 0) {
          acc.push(
            `####### ${c.file} #######\n ${lines
              .slice(i, i + this.CHUNK_SIZE)
              .join("\n")}`
          );
        }
        return acc;
      }, [] as string[]);
    });
  }
}

export default FastIndexer;
