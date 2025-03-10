import { Probot, Server } from "probot";

export const createServer = (): Server => {
    return new Server({
        Probot: Probot.defaults({
            appId: process.env.APP_ID!,
            privateKey: process.env.PRIVATE_KEY!,
            secret: process.env.WEBHOOK_SECRET!,
        }),
    });
};

export const createProbot = (): Probot => {
    return new Probot({
        appId: process.env.APP_ID!,
        privateKey: process.env.PRIVATE_KEY!,
    });
}; 