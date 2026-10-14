import { TimeZoneInput } from "@/components/time-zone-input";
import { t } from "@/lib/i18n";

export function GroupFields({
  defaults,
}: {
  defaults?: { name: string; budget: number | null; deliveryDate: string | null };
}) {
  return (
    <>
      <div>
        <label htmlFor="name" className="label">
          {t.groups.name}
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          placeholder={t.groups.namePlaceholder}
          defaultValue={defaults?.name}
          className="input"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="budget" className="label">
            {t.groups.budget}
          </label>
          <input
            id="budget"
            name="budget"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            defaultValue={defaults?.budget ?? ""}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="deliveryDate" className="label">
            {t.groups.deliveryDate}
          </label>
          <input
            id="deliveryDate"
            name="deliveryDate"
            type="date"
            defaultValue={defaults?.deliveryDate ?? ""}
            className="input"
          />
        </div>
      </div>
      <TimeZoneInput />
    </>
  );
}
