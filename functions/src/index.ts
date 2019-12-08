import * as functions from "firebase-functions";

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import * as npo from "npm-offline-packager";

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import { resolvedPackages } from "npm-offline-packager/lib/cache";

import * as tmp from "tmp";
import * as JSZip from "jszip";
import * as fs from "fs";
import * as path from "path";
import * as admin from "firebase-admin";

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
        response
            .status(200)
            .contentType("json")
            .send({ authorized: true });
    }),
);

export const nporesolve = functions
    .runWith({
        timeoutSeconds: 300,
        memory: "1GB",
    })
    .https.onRequest(
        withAuthenticate(async (request, response, user) => {
            console.log(user);
            const body = request.body;
            console.log(body);

            resolvedPackages.clean();

            const deps = await npo.resolveDependencies(body.manifest, {});
            const ret = JSON.stringify(deps, undefined, 2);
            console.log(ret);
            response
                .status(200)
                .contentType("json")
                .send(ret);
        }),
    );

export const npofetch = functions
    .runWith({
        timeoutSeconds: 300,
        memory: "256MB",
    })
    .https.onRequest(
        withAuthenticate(async (request, response, user) => {
            console.log(user);
            const body = request.body;
            console.log(body);

            const dependencies = body.dependencies;

            const tmpdir = tmp.dirSync();

            await npo.downloadPackages(dependencies, {
                destFolder: tmpdir.name,
            });

            const zip = new JSZip();
            for (const fileName of fs.readdirSync(tmpdir.name)) {
                const filePath = path.join(tmpdir.name, fileName);
                zip.file(fileName, fs.readFileSync(filePath));
                fs.unlinkSync(filePath);
            }
            const buffer = await zip.generateAsync({ type: "nodebuffer" });
            response
                .status(200)
                .contentType("application/zip")
                .send(buffer);

            fs.rmdirSync(tmpdir.name);
        }),
    );
