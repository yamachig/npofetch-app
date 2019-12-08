import React from "react";

import useAuthorized from "./useAuthorized";
import fetch from "./fetch";

const npofetch = async (manifest: unknown) => {
    const resolveResponse = await fetch("/nporesolve/", {
        method: "post",
        body: JSON.stringify({ manifest }),
        headers: { "Content-Type": "application/json" },
    });
    if (!resolveResponse.ok) {
        throw new Error(await resolveResponse.text());
    }
    const dependencies = await resolveResponse.json();
    console.log(dependencies);
    alert(dependencies.length);
};

const MainView: React.FC = () => {
    const [fetching, setFetching] = React.useState(false);

    const processNpofetch = async (manifest: unknown) => {
        setFetching(true);
        try {
            await npofetch(manifest);
        } catch (e) {
            alert(e);
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
        </>
    ) : (
        <>
            <form onSubmit={onSubmit}>
                <textarea name="manifest" />
                <input type="submit" value="送信" />
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
