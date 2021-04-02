import * as functions from "firebase-functions";
import * as tmp from "tmp";
import * as JSZip from "jszip";
import * as fs from "fs";
import * as path from "path";
import * as admin from "firebase-admin";
import { exec } from "child_process";
import { promisify } from "util";
import fetch from "node-fetch";

const console = functions.logger;

admin.initializeApp();

const users = (functions.config().users as string[]) ?? [];

const withAuthenticate = (
    handler: (req: functions.https.Request, resp: functions.Response, user: admin.auth.UserRecord) => Promise<void>,
) => {
    return async (request: functions.https.Request, response: functions.Response) => {
        if (!request.headers.authorization) {
            response.status(401).send("Authorization ヘッダが存在しません。");
            return;
        }

        const match = request.headers.authorization.match(/^Bearer (.*)$/);
        if (!match) {
            response.status(401).send("Authorization ヘッダから Bearer トークンを取得できませんでした。");
            return;
        }
        const idToken = match[1];

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const user = await admin.auth().getUser(decodedToken.uid);

        if (!user.email || !users.includes(user.email)) {
            console.log(user.email);
            response.status(401).send("認可されていないユーザです。");
            return;
        }

        await handler(request, response, user);
    };
};

export const isAuthorized = functions.https.onRequest(
    withAuthenticate(async (request, response, user) => {
        console.log(user);
        response.status(200).contentType("json").send({ authorized: true });
    }),
);

export const nporesolve = functions
    .runWith({
        timeoutSeconds: 300,
        memory: "1GB",
    })
    .https.onRequest(
        withAuthenticate(async (request, response, user) => {
            try {
                console.log(user);
                const body = request.body;

                const tmpdir = tmp.dirSync();
                await promisify(fs.writeFile)(path.join(tmpdir.name, "package.json"), JSON.stringify(body.manifest), {
                    encoding: "utf-8",
                });
                await promisify(exec)("npm install --package-lock-only", { cwd: tmpdir.name });
                const lockJson = await promisify(fs.readFile)(path.join(tmpdir.name, "package-lock.json"), {
                    encoding: "utf-8",
                });
                const lock = JSON.parse(lockJson);

                response.status(200).contentType("json").send(lock);
            } catch (e) {
                console.error(e);
                response.status(500).send(e);
            }
        }),
    );

const aggregateResolved = (obj: Record<string, unknown>): string[] => {
    if (typeof obj !== "object") return [];
    const ret: string[] = [];
    for (const key in obj) {
        if (key === "resolved" && typeof obj[key] === "string") {
            ret.push(obj[key] as string);
        } else {
            ret.push(...aggregateResolved(obj[key] as Record<string, unknown>));
        }
    }
    return ret;
};

export const npofetch = functions
    .runWith({
        timeoutSeconds: 300,
        memory: "256MB",
    })
    .https.onRequest(
        withAuthenticate(async (request, response, user) => {
            try {
                console.log(user);
                const urls = request.body.urls;

                const zip = new JSZip();
                for (const url of urls) {
                    const basename = url.split("/").slice(-1)[0];
                    const mAt = /\/(@[^/]+)\//.exec(url);
                    const fileName = `${mAt ? mAt[1] + "-" : ""}${basename}`;
                    console.log(`fetch("${url}")`);
                    const res = await fetch(url);
                    const buf = await res.arrayBuffer();
                    zip.file(fileName, buf);
                }
                const buffer = await zip.generateAsync({ type: "nodebuffer" });
                response.status(200).contentType("application/zip").send(buffer);
            } catch (e) {
                console.error(e);
                response.status(500).send(e);
            }
        }),
    );
