// Prints the ADMIN_LOGIN_HASH line for .env.local. Run: node scripts/hash-admin-password.mjs
import { createInterface } from "node:readline/promises";
import { randomBytes, scryptSync } from "node:crypto";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("New admin password (shown as you type): ");
rl.close();
if (password.length < 12) { console.error("Use at least 12 characters."); process.exit(1); }
const salt = randomBytes(16).toString("hex");
console.log(`\nADMIN_LOGIN_HASH=${salt}:${scryptSync(password, salt, 32).toString("hex")}`);
