// @ts-nocheck
const DB_NAME = "authDB";
const STORE_NAME = "authSessions";
const DB_VERSION = 1;

function openDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "id" }); // Single entry
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function saveAuthSession(userProfile, accessToken) {
	console.log("[saveAuthSession] Saving session:", { userProfile, accessToken });
	
	if (!userProfile || !accessToken) {
		console.error("[saveAuthSession] Missing userProfile or accessToken:", { userProfile, accessToken });
		return;
	}

	const db = await openDB();
	const tx = db.transaction(STORE_NAME, "readwrite");
	const store = tx.objectStore(STORE_NAME);

	// Clear the previous session
	store.clear().onsuccess = () => {
		console.log("[saveAuthSession] Cleared previous session");
		// Store the new session (fixed key "session" ensures only one record exists)
		const dateExpire = (Date.now() + 23 * 60 * 60 * 1000).toString();

		store.put({
			id: "session",
			userProfile,
			accessToken,
			dateExpire,
		});
		console.log("[saveAuthSession] Session saved successfully");
	};

	return tx.complete;
}

export async function getAuthSession() {
	console.log("[getAuthSession] Retrieving session...");
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, "readonly");
	const store = tx.objectStore(STORE_NAME);

	return new Promise((resolve) => {
		const request = store.get("session");
		request.onsuccess = () => {
			console.log("[getAuthSession] Session retrieved:", request.result);
			resolve(request.result);
		};
		request.onerror = () => {
			console.error("[getAuthSession] Failed to retrieve session");
			resolve(null);
		};
	});
}

export async function removeAuthSession() {
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, "readwrite");
	const store = tx.objectStore(STORE_NAME);

	store.delete("session");

	return tx.complete;
}
