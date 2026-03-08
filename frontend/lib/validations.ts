import { z } from "zod";

// Study validations
export const createStudySchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().optional(),
  motivation: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).default("DRAFT"),
  researchQuestions: z
    .array(
      z.object({
        question: z.string().min(1, "Question is required"),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
});

export const updateStudySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  motivation: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});

// Study Parameters validations
export const studyParametersSchema = z.object({
  formalSources: z
    .array(
      z.object({
        name: z.string().min(1, "Name is required"),
        type: z.enum(["ACADEMIC_DATABASE", "JOURNAL", "CONFERENCE_PROCEEDINGS"]),
        searchString: z.string().optional(),
        dateRange: z
          .object({
            start: z.string().optional(),
            end: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  greySources: z
    .array(
      z.object({
        name: z.string().min(1, "Name is required"),
        type: z.enum([
          "BLOG",
          "WHITE_PAPER",
          "TECHNICAL_REPORT",
          "PREPRINT_SERVER",
          "COMPANY_WEBSITE",
          "RESEARCH_LAB_SITE",
          "GOVERNMENT_REPORT",
        ]),
        url: z.string().url().optional(),
        searchStrategy: z.string().optional(),
      }),
    )
    .optional(),
  inclusionCriteria: z
    .array(
      z.object({
        criterion: z.string().min(1, "Criterion is required"),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
  exclusionCriteria: z
    .array(
      z.object({
        criterion: z.string().min(1, "Criterion is required"),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
  classificationSchema: z.any().optional(), // Can be array or object
});

// Source upload validations
export const uploadSourceSchema = z.object({
  title: z.string().optional(),
  authors: z.array(z.string()).optional(),
  publicationDate: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
  abstract: z.string().optional().nullable(),
  keywords: z.array(z.string()).optional(),
  url: z.string().optional().nullable(),
  sourceOrigin: z.string().optional().nullable(),
  sourceCategory: z.enum(["FORMAL", "GREY"]).optional(),
});

export type CreateStudyInput = z.infer<typeof createStudySchema>;
export type UpdateStudyInput = z.infer<typeof updateStudySchema>;
export type StudyParametersInput = z.infer<typeof studyParametersSchema>;
export type UploadSourceInput = z.infer<typeof uploadSourceSchema>;
