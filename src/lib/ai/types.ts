import type { z } from "zod";
import type { solverResponseSchema } from "./validation";

export type SolverResponse = z.infer<typeof solverResponseSchema>;

export type SolveTextInput = {
  prompt: string;
  locale: "vi" | "en";
};

export type SolveImageInput = {
  image: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  prompt?: string;
  locale: "vi" | "en";
};

export type SimilarProblemInput = {
  stem: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  skillTags: string[];
  explanation?: string;
  locale: "vi" | "en";
};

export type SimilarProblem = {
  statement: string;
  questionType: "multiple_choice" | "short_answer";
  choices: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  sourceContext: string;
};

export type ChatInput = {
  messages: { role: "user" | "assistant"; content: string }[];
  locale: "vi" | "en";
};

export type RecommendationInput = {
  topic: string | null;
  accuracyPercent: number | null;
  targetScore: number | null;
  currentAverage: number | null;
  scoreTrend: "improving" | "declining" | "stable" | "insufficient_data";
  attemptCount: number;
  locale: "vi" | "en";
};

export interface AIProvider {
  chat(input: ChatInput): Promise<string>;
  solveText(input: SolveTextInput): Promise<SolverResponse>;
  solveImage(input: SolveImageInput): Promise<SolverResponse>;
  generateSimilarProblem(input: SimilarProblemInput): Promise<SimilarProblem>;
  recommend(input: RecommendationInput): Promise<string>;
}

export type AIProviderName = "openai" | "anthropic";

export class AIProviderNotConfiguredError extends Error {
  constructor(provider: AIProviderName) {
    super(`The ${provider} AI provider is not configured.`);
    this.name = "AIProviderNotConfiguredError";
  }
}
