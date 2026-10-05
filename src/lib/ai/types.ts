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
  stem: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export interface AIProvider {
  solveText(input: SolveTextInput): Promise<SolverResponse>;
  solveImage(input: SolveImageInput): Promise<SolverResponse>;
  generateSimilarProblem(input: SimilarProblemInput): Promise<SimilarProblem>;
}

export type AIProviderName = "openai" | "anthropic";

export class AIProviderNotConfiguredError extends Error {
  constructor(provider: AIProviderName) {
    super(`The ${provider} AI provider is not configured.`);
    this.name = "AIProviderNotConfiguredError";
  }
}
