import { promisify } from "util";
import { exec } from "child_process";
import { logger } from "../logger";
import tmp from "tmp";

tmp.setGracefulCleanup();
const execAsync = promisify(exec);

export class Git {
    private repoPath: string;
    private clonedPath: string;
    private accessToken: string;

    constructor(repoPath: string, accessToken: string) {
        this.repoPath = repoPath;
        this.accessToken = accessToken;
        const tempDirectory = tmp.dirSync();
        this.clonedPath = tempDirectory.name;

        this.cloneRepository();
    }

    private async cloneRepository() {
        try {
            // Construct the Git URL with the access token
            const modifiedRepoUrl = this.repoPath.replace(
                "https://",
                `https://git:${this.accessToken}@`
            );

            // Execute the git clone command
            await execAsync(`git clone ${modifiedRepoUrl} ${this.clonedPath}`);

            logger.info(`Repository cloned successfully to ${this.clonedPath}`);
        } catch (error) {
            logger.error("Error cloning repository:", error);
        }
    }

    private async executeGitCommand(args: string[]) {
        const { stdout, stderr } = await execAsync(`git ${args.join(" ")}`, {
            cwd: this.clonedPath,
        });

        if (stderr) {
            logger.warn("Git command warning:", stderr);
        }

        return stdout.trim();
    }
}