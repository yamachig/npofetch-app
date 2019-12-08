import React from "react";
import firebase from "firebase/app";
import "firebase/auth";
import fetch from "./fetch";
import firebaseConfig from "./firebaseConfig.json";

const signInWithRedirect = async (selectAccount = false) => {
    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const provider = new firebase.auth.GoogleAuthProvider();
    if (selectAccount) provider.setCustomParameters({ prompt: "select_account" });
    await firebase.auth().signInWithRedirect(provider);
};

export default () => {
    const [authorized, setAuthorized] = React.useState(false);

    React.useEffect(() => {
        (async () => {
            firebase.initializeApp(firebaseConfig);

            firebase.auth().onAuthStateChanged(async user => {
                console.log({ user });
                if (user) {
                    try {
                        const response = await fetch("/isAuthorized/");
                        if (response.ok && (await response.json()).authorized) {
                            setAuthorized(true);
                        } else {
                            const errMsg = await response.text();
                            throw new Error(errMsg);
                        }
                    } catch (err) {
                        console.error(err);
                        alert(err);
                        await firebase.auth().signOut();
                        await signInWithRedirect(true);
                    }
                } else {
                    await signInWithRedirect();
                }
            });
        })();
    }, []);

    return { authorized };
};
