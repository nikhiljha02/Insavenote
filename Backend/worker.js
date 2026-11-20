
import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { createApp } from "./app.js";

const app = createApp(env);

app.listen(3000);

export default httpServerHandler({ port: 3000 });
