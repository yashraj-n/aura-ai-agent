import { createServer, createProbot } from "./config/server";
import { initializeApp } from "./app/init";
import { logger } from "./logger";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export let authenticatedUser:
    | RestEndpointMethodTypes["apps"]["getAuthenticated"]["response"]
    | null = null;

async function startServer() {
    try {
        const server = createServer();
        await server.load(initializeApp);

        const probot = createProbot();
        const octokit = await probot.auth();
        const appInfo = await octokit.apps.getAuthenticated();
        authenticatedUser = appInfo;

        let repos = await octokit.apps.getInstallation();
        let listOfRepos: (typeof repos.data)[] = repos.data;
        console.log(listOfRepos);

        let accessToken = await octokit.apps.createInstallationAccessToken({
            installation_id: listOfRepos[0].id,
        });

        logger.info(
            `Starting server authenticated as GitHub App: ${appInfo.data?.name}`
        );
        await server.start();
    } catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();
