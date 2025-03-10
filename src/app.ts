import { run, Probot, Server } from "probot";

const a = (app: Probot) => {
    app.onError((error) => {
        console.log(error);
    });

    app.on("issue_comment.created", event =>{
        console.log(event.payload.comment)
    })
    
}

const server = new Server({
    Probot: Probot.defaults({
        appId: process.env.APP_ID!,
        privateKey: process.env.PRIVATE_KEY!,
        secret: process.env.WEBHOOK_SECRET!,
    }),
});
await server.load(a);
server.start()