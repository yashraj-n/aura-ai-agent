import fs from "fs/promises";
import { glob } from "glob";
import { logger } from "../../logger";

class FastIndexer {
    CHUNK_SIZE = 100;
    constructor(private repo_path: string) {
        this.repo_path = repo_path;
    }

    private async index() {
        await this.waitForDirectory(this.repo_path);
        const files = await glob(this.repo_path + "/**/*");
        const fileStats = await Promise.all(
            files.map(async (file) => ({
                file,
                stat: await fs.stat(file),
            }))
        );
        const fileOnly = fileStats
            .filter(({ stat }) => stat.isFile())
            .map(({ file }) => file);
        let chunks = await Promise.all(
            fileOnly.map(async (file) => {
                const content = await fs.readFile(file, "utf-8");
                return {
                    file,
                    content,
                };
            })
        );
        return chunks;
    }

    private waitForDirectory(path: string) {
        return new Promise(async (resolve, reject) => {
            const interval = setInterval(async () => {
                const stat = await fs.stat(path);
                if (stat.isDirectory()) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 1000);
        });
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
