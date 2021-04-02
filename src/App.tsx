import React from "react";

import useAuthorized from "./useAuthorized";
import fetch from "./fetch";
import FileSaver from "file-saver";
import JSZip from "jszip";

const NUMBER_IN_WORKER = 10;

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

const npofetch = async (manifest: unknown, progress?: (ratio: number, message: string) => void) => {
    progress?.(0, "依存関係を分析しています…");

    const resolveResponse = await fetch("/nporesolve/", {
        method: "post",
        body: JSON.stringify({ manifest }),
        headers: { "Content-Type": "application/json" },
    });

    if (!resolveResponse.ok) {
        throw new Error(await resolveResponse.text());
    }

    const lock: Record<string, unknown> = await resolveResponse.json();
    const urls = aggregateResolved(lock);

    progress?.(0, "依存関係の分析が完了しました。");

    let processedCount = 0;

    const destZip = new JSZip();

    const processDownloadedFile = async (zipData: ArrayBuffer) => {
        const srcZip = await JSZip.loadAsync(zipData);

        const items: Array<[string, JSZip.JSZipObject]> = [];
        srcZip.forEach((relativePath, file) => {
            items.push([relativePath, file]);
        });

        for (const [relativePath, file] of Object.entries(srcZip.files)) {
            if (file.dir) {
                continue;
            }
            const innerData = await file.async("arraybuffer");
            destZip.file(relativePath, innerData);
            processedCount += 1;
            progress?.(processedCount / urls.length, relativePath);
        }
    };

    const workers: Promise<void>[] = [];
    const workerCount = Math.ceil(urls.length / NUMBER_IN_WORKER);

    const createWorker = (urls: string[]) => async () => {
        const fetchResponse = await fetch("/npofetch/", {
            method: "post",
            body: JSON.stringify({ urls }),
            headers: { "Content-Type": "application/json" },
        });

        if (!fetchResponse.ok) {
            const message = await fetchResponse.text();
            console.error({ urls, message, fetchResponse });
            throw new Error(message);
        }

        const zipData = await fetchResponse.arrayBuffer();
        try {
            await processDownloadedFile(zipData);
        } catch (e) {
            console.error({ urls, zipData: new Blob([zipData], { type: "application/zip" }) });
        }
    };

    for (let i = 0; i < workerCount; i++) {
        const partUrls = urls.slice(i * NUMBER_IN_WORKER, (i + 1) * NUMBER_IN_WORKER);
        workers.push(createWorker(partUrls)());
    }

    console.log({ total: urls.length, workers, workerCount, NUMBER_IN_WORKER });

    await Promise.all(workers);

    const data = await destZip.generateAsync({ type: "arraybuffer" });
    FileSaver.saveAs(new Blob([data]), "packages.zip");
};

const DownloadStateView: React.FC<{
    ratio: number;
    message: string;
}> = (props) => {
    return (
        <div>
            <div
                style={{
                    whiteSpace: "nowrap",
                    width: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {props.ratio < 1 ? `ダウンロード中: ${props.message}` : "ダウンロード完了"}
            </div>
            <div className="progress" style={{ backgroundColor: "white" }}>
                <div
                    className="progress-bar progress-bar-striped progress-bar-animated"
                    role="progressbar"
                    style={{ width: `${props.ratio * 100}%` }}
                ></div>
            </div>
        </div>
    );
};

const MainView: React.FC = () => {
    const [fetching, setFetching] = React.useState(false);
    const [progress, setProgress] = React.useState({ ratio: 0, message: "" });

    const processNpofetch = async (manifest: unknown) => {
        setFetching(true);
        try {
            await npofetch(manifest, (ratio, message) => {
                setProgress({ ratio, message });
            });
        } catch (e) {
            console.error(e);
        }
        setFetching(false);
    };

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.stopPropagation();
        e.preventDefault();

        const manifestStr = e.currentTarget.manifest?.value ?? "{}";
        const manifest = JSON.parse(manifestStr);
        processNpofetch(manifest);

        return false;
    };

    return fetching ? (
        <>
            <div className="spinner-border" role="status">
                <span className="sr-only">Loading...</span>
            </div>
            <DownloadStateView ratio={progress.ratio} message={progress.message} />
        </>
    ) : (
        <>
            <form onSubmit={onSubmit}>
                <textarea name="manifest" style={{ width: "100%", height: "20em" }} />
                <input type="submit" value="送信" className="btn btn-primary" />
            </form>
        </>
    );
};

const App: React.FC = () => {
    const { authorized } = useAuthorized();

    return authorized ? (
        <MainView />
    ) : (
        <>
            <div className="spinner-grow" role="status">
                <span className="sr-only">Loading...</span>
            </div>
        </>
    );
};

export default App;
