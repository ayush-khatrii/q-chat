import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Cache Components does not allow `runtime`/`dynamic` segment configs here.
// Node.js is already the default runtime, and these handlers read the incoming
// request (cookies + session), so they remain dynamic on their own.
export const { GET, POST } = toNextJsHandler(auth);
