import { z } from "zod";
import { t } from "@/lib/i18n";

const v = t.validation;

export const nameSchema = z.string(v.nameRequired).trim().min(1, v.nameRequired).max(60, v.nameTooLong);

export const emailSchema = z
  .string(v.emailInvalid)
  .trim()
  .toLowerCase()
  .pipe(z.email(v.emailInvalid).max(254, v.emailInvalid));

export const codeSchema = z
  .string(v.codeInvalid)
  .trim()
  .regex(/^\d{6}$/, v.codeInvalid);

/** Only absolute http(s) URLs are accepted for store links. */
export const safeUrlSchema = z
  .string()
  .trim()
  .max(2000, v.urlInvalid)
  .pipe(z.url({ protocol: /^https?$/, hostname: z.regexes.domain, error: v.urlInvalid }));

export const optionalSafeUrlSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(safeUrlSchema.optional());

const optionalBudget = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Number(value)))
  .pipe(
    z.number(v.budgetInvalid).int(v.budgetInvalid).min(0, v.budgetInvalid).max(100_000, v.budgetInvalid).nullable(),
  );

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.iso.date(v.dateInvalid).nullable());

export const timeZoneSchema = z
  .string()
  .trim()
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("es-ES", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  })
  .catch("Europe/Madrid");

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, v.groupNameRequired).max(80, v.groupNameTooLong),
  budget: optionalBudget,
  deliveryDate: optionalDate,
  surpriseMode: z.literal("on").optional().transform(Boolean),
  adminParticipates: z.literal("on").optional().transform(Boolean),
  timezone: timeZoneSchema,
});

export const updateGroupSchema = createGroupSchema.omit({ surpriseMode: true, adminParticipates: true });

export const scheduleDrawSchema = z.object({
  // ISO string computed in the browser from the local date/time input.
  scheduledAt: z.iso.datetime({ offset: true, error: v.dateTimeInvalid }).transform((value) => new Date(value)),
  timezone: timeZoneSchema,
});

export const wishlistItemSchema = z.object({
  text: z.string().trim().min(1, v.wishTextRequired).max(200, v.wishTextTooLong),
  url: optionalSafeUrlSchema,
});

export const addParticipantSchema = z.object({
  name: nameSchema,
  email: emailSchema,
});

/** Flattens Zod issues into a single readable message for forms. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? t.errors.generic;
}
