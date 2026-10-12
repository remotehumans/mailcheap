// Route handlers are not covered by the Server Action body limit.
export class RequestBodyError extends Error {
 constructor(message, status) { super(message); this.status = status; }
}

export async function readLimitedBody(request, maxBytes, timeoutMs = 10000) {
 const declared = request.headers.get("content-length");
 if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
  throw new RequestBodyError("Body is too large", 413);
 }
 if (!request.body) return new Uint8Array();
 const reader = request.body.getReader();
 const chunks = [];
 let size = 0, timer;
 const deadline = new Promise((_, reject) => {
  timer = setTimeout(() => reject(new RequestBodyError("Request timed out", 408)), timeoutMs);
 });
 try {
  while (true) {
   const { done, value } = await Promise.race([reader.read(), deadline]);
   if (done) break;
   size += value.byteLength;
   if (size > maxBytes) throw new RequestBodyError("Body is too large", 413);
   chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
 } catch (error) {
  void reader.cancel().catch(() => {});
  throw error;
 } finally { clearTimeout(timer); reader.releaseLock(); }
}

export async function readLimitedText(request, maxBytes) {
 return new TextDecoder().decode(await readLimitedBody(request, maxBytes));
}
