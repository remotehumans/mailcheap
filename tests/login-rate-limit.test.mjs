import assert from "node:assert/strict";
import { test } from "node:test";
import { isLoginRateLimited } from "../lib/login-rate-limit.js";
import { isLimitedInMemory } from "../lib/rate-limit.js";

test("rotating forwarded IPs cannot bypass the account-wide limit", async () => {
 const limit = async options => isLimitedInMemory({ ...options, name: "regression-"+options.name });
 for (let i = 0; i < 30; i++) assert.equal(await isLoginRateLimited(new Headers({ "x-forwarded-for": "203.0.113."+i }), limit), false);
 assert.equal(await isLoginRateLimited(new Headers({ "x-forwarded-for": "198.51.100.99" }), limit), true);
});
