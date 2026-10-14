"use client";

import { useState } from "react";
import { TimeZoneInput } from "@/components/time-zone-input";
import { t } from "@/lib/i18n";

/**
 * `datetime-local` has no time zone. The browser converts the local value to a
 * UTC ISO string, which is what the server stores.
 */
export function ScheduleInput() {
  const [local, setLocal] = useState("");
  const iso = local ? new Date(local).toISOString() : "";

  return (
    <div>
      <label htmlFor="scheduledAtLocal" className="label">
        {t.draw.scheduleAt}
      </label>
      <input
        id="scheduledAtLocal"
        type="datetime-local"
        required
        className="input"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
      />
      <input type="hidden" name="scheduledAt" value={iso} />
      <TimeZoneInput />
    </div>
  );
}
