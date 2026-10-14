"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Hidden input with the browser's IANA time zone. */
export function TimeZoneInput() {
  const timeZone = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "Europe/Madrid",
  );
  return <input type="hidden" name="timezone" value={timeZone} />;
}
