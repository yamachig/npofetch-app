import firebase from "firebase/app";
import "firebase/auth";
import customFetch from "./customFetch";

export const defaultFetch = async (input: RequestInfo, init?: RequestInit | undefined) => {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("User not authenticated.");
    const token = await user.getIdToken(true);
    return fetch(input, {
        ...init,
        headers: {
            ...init?.headers,
            Authorization: `Bearer ${token}`,
        },
    });
};

export default customFetch ?? defaultFetch;
