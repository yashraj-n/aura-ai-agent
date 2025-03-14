import { promisify } from "util";
import { exec } from "child_process";
import { logger } from "../logger";
import tmp from "tmp";
import { rm } from "fs/promises";
import { humanId } from "human-id";

tmp.setGracefulCleanup();
const execAsync = promisify(exec);

type RepoDetails = {
    owner: string;
    repo: string;
};

export class Git {
    private repoDetails: RepoDetails;
    private clonedPath: string;
    private accessToken: string;

    constructor(repoDetails: RepoDetails, accessToken: string) {
        this.repoDetails = repoDetails;
        this.accessToken = accessToken;
        this.clonedPath = tmp.dirSync().name;
    }

    public async cloneRepository() {
        try {
            const modifiedRepoUrl = `https://git:${this.accessToken}@github.com/${this.repoDetails.owner}/${this.repoDetails.repo}.git`;
            await this.executeGitCommand([
                "clone",
                modifiedRepoUrl,
                this.clonedPath,
            ]);

            logger.info(`Repository cloned successfully to ${this.clonedPath}`);

            // // Adding Origin
            // await this.executeGitCommand([
            //     "remote",
            //     "add",
            //     "origin",
            //     modifiedRepoUrl,
            // ]);

            return this.clonedPath;
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

    public async createPullRequest(issueNumber: number | string) {
        // Create a new branch
        const branchName = `feature-request-${issueNumber}-${humanId()}`;
        logger.info(`Creating new branch: ${branchName}`);
        await this.executeGitCommand(["checkout", "-b", branchName]);

        logger.info("Adding all changes");
        await this.executeGitCommand(["add", "."]);

        logger.info("Committing changes");
        await this.executeGitCommand([
            "commit",
            "-m",
            `"Feature Request for issue #${issueNumber}"`,
        ]);

        logger.info(`Pushing branch ${branchName} to origin`);
        await this.executeGitCommand(["push", "origin", branchName, "--force"]);

        return branchName;
    }

    public getClonedPath() {
        return this.clonedPath;
    }

    public async cleanup() {
        logger.info(`Cleaning up cloned repository at ${this.clonedPath}`);
        await rm(this.clonedPath, { recursive: true, force: true });
    }
}
