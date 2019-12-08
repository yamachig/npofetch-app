import firebase from "firebase/app";
import "firebase/auth";

export default async (input: RequestInfo, init?: RequestInit | undefined) => {
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
