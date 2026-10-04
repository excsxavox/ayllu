import { z } from "zod";
import { KNOWLEDGE_SOURCES } from "./enums";

export const knowledgeDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  sourceType: z.enum(KNOWLEDGE_SOURCES).default("FAQ"),
});

export type KnowledgeDocumentInput = z.infer<typeof knowledgeDocumentSchema>;
