/** Runtime caches that may hold per-user pages; cleared on logout so another person on the device cannot read them. */
export const PRIVATE_CACHE_PREFIX = "ai-private-";

export async function clearPrivateCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(PRIVATE_CACHE_PREFIX)).map((key) => caches.delete(key)));
}
