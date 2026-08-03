// @ts-nocheck
const openDB = async () => {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("UserAccountsDB", 1);

		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains("accounts")) {
				db.createObjectStore("accounts", {
					keyPath: "id",
					autoIncrement: true,
				});
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
};

export const getAccountByUsernameAndPlatform = async (username, platform) => {
	const db = await openDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction("accounts", "readonly");
		const store = tx.objectStore("accounts");

		const request = store.getAll(); // Get all accounts

		request.onsuccess = () => {
			const accounts = request.result;
			const existingAccount = accounts.find(
				(acc) => acc.username === username && acc.platform === platform,
			);
			resolve(existingAccount || null);
		};
		request.onerror = () => reject(request.error);
	});
};

export const addAccountStore = async (account) => {
	console.log("[addAccountStore] Attempting to add account:", account);

	if (!account || !account.username) {
		console.error(
			"[addAccountStore] Invalid account data - missing username:",
			account,
		);
		return null;
	}

	const db = await openDB();

	// Prevent duplicate
	const existingAccount = await getAccountByUsernameAndPlatform(
		account.username,
		account.platform,
	);

	if (existingAccount) {
		console.log(
			"[addAccountStore] Account already exists, skipping:",
			existingAccount,
		);
		return null;
	}

	console.log("[addAccountStore] No duplicate found, proceeding to add...");

	return new Promise((resolve, reject) => {
		const tx = db.transaction("accounts", "readwrite");
		const store = tx.objectStore("accounts");

		tx.oncomplete = () => {
			console.log("[addAccountStore] Transaction completed successfully");
		};

		tx.onerror = () => {
			console.error("[addAccountStore] Transaction failed:", tx.error);
			reject(tx.error);
		};

		// Add the new account first
		const addRequest = store.add(account);

		addRequest.onsuccess = () => {
			console.log(
				"[addAccountStore] Account added successfully, ID:",
				addRequest.result,
			);
			// After adding, get all accounts
			const getAllRequest = store.getAll();

			getAllRequest.onsuccess = () => {
				let accounts = getAllRequest.result;
				console.log("[addAccountStore] All accounts after add (in transaction):", accounts);

				// Sort descending so newest account comes first
				accounts.sort((a, b) => b.id - a.id);

				// Delete oldest accounts if there are more than 5
				if (accounts.length > 5) {
					const toDelete = accounts.slice(5); // everything after the first 5
					console.log("[addAccountStore] Deleting oldest accounts:", toDelete);
					toDelete.forEach((acc) => store.delete(acc.id));
				}

				resolve(addRequest.result);
			};

			getAllRequest.onerror = () => {
				console.error("[addAccountStore] getAll failed:", getAllRequest.error);
				reject(getAllRequest.error);
			};
		};

		addRequest.onerror = () => {
			console.error("[addAccountStore] Add failed:", addRequest.error);
			reject(addRequest.error);
		};
	}).then(async (result) => {
		// Verify data was actually persisted by reading from a NEW DB connection
		console.log("[addAccountStore] Verifying persistence...");
		const verifyDb = await openDB();
		const verifyTx = verifyDb.transaction("accounts", "readonly");
		const verifyStore = verifyTx.objectStore("accounts");
		const verifyRequest = verifyStore.getAll();
		
		return new Promise((resolve, reject) => {
			verifyRequest.onsuccess = () => {
				console.log("[addAccountStore] Verification - accounts in persistent storage:", verifyRequest.result);
				resolve(result);
			};
			verifyRequest.onerror = () => {
				console.error("[addAccountStore] Verification failed:", verifyRequest.error);
				reject(verifyRequest.error);
			};
		});
	});
};

// export const addAccountStore = async (account) => {
//   const db = await openDB();

//   // Check if account with same username AND platform exists
//   const existingAccount = await getAccountByUsernameAndPlatform(
//     account.username,
//     account.platform
//   );

//   if (existingAccount) {
//     // console.log("Account already exists:", existingAccount);
//     return null; // Prevent duplicate
//   }

//   return new Promise((resolve, reject) => {
//     const tx = db.transaction("accounts", "readwrite");
//     const store = tx.objectStore("accounts");

//     const request = store.add(account); // Ensure correct data is being added

//     request.onsuccess = (event) => {
//       // console.log(`Account added with ID: ${event.target.result}`);
//       resolve(event.target.result);
//     };
//     request.onerror = () => reject(request.error);
//   });
// };

export const getAccounts = async () => {
	console.log("[getAccounts] Retrieving all accounts...");
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction("accounts", "readonly");
		const store = tx.objectStore("accounts");
		const request = store.getAll();

		request.onsuccess = () => {
			console.log("[getAccounts] Accounts retrieved:", request.result);
			console.log({ request: request.result });
			resolve(request.result);
		};
		request.onerror = () => {
			console.error("[getAccounts] Failed to retrieve accounts");
			reject(request.error);
		};
	});
};

export const deleteAccountStore = async (id) => {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction("accounts", "readwrite");
		const store = tx.objectStore("accounts");
		const request = store.delete(id);

		request.onsuccess = () => {
			console.log(`Account with ID ${id} deleted`);
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
};

export const clearAccountStore = async () => {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction("accounts", "readwrite");
		const store = tx.objectStore("accounts");
		const request = store.clear();

		request.onsuccess = () => {
			console.log("All accounts have been cleared.");
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
};
