import { promisify } from "util";
import { exec } from "child_process";
import { logger } from "../logger";
import tmp from "tmp";

tmp.setGracefulCleanup();
const execAsync = promisify(exec);

export class Git {
    private repoPath: string;
    private clonedPath: string;

    constructor(repoPath: string) {
        this.repoPath = repoPath;
        let tempDirectory = tmp.dirSync();

        // Trying to clone the repo
    }

    private async executeGitCommand(args: string[]) {
        const { stdout, stderr } = await execAsync(`git ${args.join(" ")}`, {
            cwd: this.clonedPath,
        });
        return stdout.trim();
    }
}
