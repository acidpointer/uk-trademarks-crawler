import { z } from "zod";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

export const TrademarksWordSearchMatchTypeEnum = z.enum([
    'ALLWORDS',
    'ANYWORDS',
]);

export const TrademarksSearchTypeEnum = z.enum([
  "SIMILAR",
  "EXACT",
  "CONTAINSSTRING",
  "CONTAINSWORD",
  "STARTSWITH",
]);
export const TrademarksLegalStatusEnum = z.enum([
  "ALLLEGALSTATUSES",
  "LIVELEGALSTATUS",
  "DEADLEGALSTATUS",
]);

export const SearchQuerySchema = z.object({
  words: z
    .string()
    .min(1, { message: "Search words are required" })
    .transform((val) => val.split(",")),
  type: TrademarksSearchTypeEnum.default("EXACT"),
  wordMatchType: TrademarksWordSearchMatchTypeEnum.default("ANYWORDS"),
  status: TrademarksLegalStatusEnum.default("ALLLEGALSTATUSES"),
  perPage: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive())
    .default("10"),
  classes: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : [])),
  fromDate: z
    .string()
    .optional()
    .refine((val) => !val || dayjs(val, "DD-MM-YYYY", true).isValid(), {
      message: "Invalid date format. Use DD-MM-YYYY",
    })
    .transform((val) => (val ? dayjs(val, "DD-MM-YYYY").toDate() : undefined)),
  toDate: z
    .string()
    .optional()
    .refine((val) => !val || dayjs(val, "DD-MM-YYYY", true).isValid(), {
      message: "Invalid date format. Use DD-MM-YYYY",
    })
    .transform((val) => (val ? dayjs(val, "DD-MM-YYYY").toDate() : undefined)),
});

export const TrademarkSchema = z.object({
  id: z.string(),
  status: z.string(),
  markText: z.string(),
  fileDate: z.string(),
  classes: z.string(),
});

export const SearchResponseSchema = z.object({
  results: z.array(TrademarkSchema),
  meta: z.object({
    count: z.number(),
    searchWords: z.array(z.string()),
    searchType: TrademarksSearchTypeEnum,
    legalStatus: TrademarksLegalStatusEnum,
    resultsPerPage: z.number(),
    classIds: z.array(z.string()),
    fromDate: z.date().optional(),
    toDate: z.date().optional(),
  }),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.any().optional(),
});
