export function assertInternalApiKey(req: Request) {
  const expected = process.env.INTERNAL_API_KEY;
  const provided = req.headers.get("x-internal-api-key");

  if (!expected) {
    throw new Error("INTERNAL_API_KEY_MISSING");
  }

  if (!provided || provided !== expected) {
    throw new Error("UNAUTHORIZED");
  }
}
