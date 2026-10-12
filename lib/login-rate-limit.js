import { getClientIp, isRateLimited } from "./rate-limit.js";

const PER_IP = { name: "login-ip", limit: 10, window: "15 m" };
const PER_ACCOUNT = { name: "login-account", limit: 30, window: "15 m" };

// A changed forwarding header must never create unlimited guesses against the only account.
export async function isLoginRateLimited(headers, limit = isRateLimited) {
 if (await limit({ ...PER_ACCOUNT, key: "admin" })) return true;
 return limit({ ...PER_IP, key: getClientIp(headers) });
}
