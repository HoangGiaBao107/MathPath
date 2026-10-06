import "server-only";

import { readServerEnv } from "@/lib/config/env";
import { validateMathContent } from "@/lib/problems/math-content";
import {
  AIProviderNotConfiguredError,
  type AIProvider,
  type AIProviderName,
  type ChatInput,
  type RecommendationInput,
  type SimilarProblem,
  type SimilarProblemInput,
  type SolveImageInput,
  type SolveTextInput,
  type SolverResponse,
} from "./types";
import { solverResponseSchema } from "./validation";
import { z } from "zod";

const similarProblemSchema = z.object({
  statement: z.string().min(1).max(4000),
  questionType: z.enum(["multiple_choice", "short_answer"]),
  choices: z.array(z.string().min(1).max(500)).max(8),
  correctAnswer: z.string().min(1).max(500),
  explanation: z.string().min(1).max(5000),
  topic: z.string().min(1).max(120),
  difficulty: z.enum(["easy", "medium", "hard"]),
  sourceContext: z.string().min(1).max(500),
});

const chatResultSchema = z.object({ answer: z.string().min(1).max(12000) });

class HttpMathPathProvider implements AIProvider {
  constructor(
    readonly name: AIProviderName,
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async chat(input: ChatInput): Promise<string> {
    const text = await this.complete(
      [{ role: "system", content: chatSystem(input.locale) }, ...input.messages],
      false,
    );
    const decoded = parseJson<unknown>(text);
    return chatResultSchema.parse(decoded).answer;
  }

  async solveText(input: SolveTextInput): Promise<SolverResponse> {
    return validateSolver(
      await this.complete(
        [{ role: "user", content: solvePrompt(input.prompt, input.locale) }],
        true,
      ),
    );
  }

  async solveImage(input: SolveImageInput): Promise<SolverResponse> {
    const image = Buffer.from(input.image).toString("base64");
    const text = input.prompt?.trim() ?? "";
    const userPrompt = `${solveSystem(input.locale)}\n\n${text ? `Ghi chú của học sinh: ${text}\n\n` : ""}Hãy đọc chính xác nội dung trong ảnh. Nếu ký hiệu/điều kiện nào không rõ, nêu rõ ở confidenceNote và không đoán.`;
    const response = await this.requestImage(userPrompt, image, input.mimeType);
    return validateSolver(response);
  }

  async generateSimilarProblem(input: SimilarProblemInput): Promise<SimilarProblem> {
    const text = await this.complete([{ role: "user", content: practicePrompt(input) }], true);
    const value = similarProblemSchema.parse(parseJson<unknown>(text));
    for (const field of [
      value.statement,
      ...value.choices,
      value.correctAnswer,
      value.explanation,
    ]) {
      assertValidMath(field);
    }
    if (
      value.questionType === "multiple_choice" &&
      (value.choices.length < 2 || !value.choices.includes(value.correctAnswer))
    ) {
      throw new AIOutputInvalidError();
    }
    if (value.questionType === "short_answer" && value.choices.length !== 0) {
      throw new AIOutputInvalidError();
    }
    return value;
  }

  async recommend(input: RecommendationInput): Promise<string> {
    const text = await this.complete(
      [{ role: "user", content: recommendationPrompt(input) }],
      false,
    );
    return chatResultSchema.parse(parseJson<unknown>(text)).answer;
  }

  private async complete(
    messages: { role: "user" | "assistant" | "system"; content: string }[],
    json: boolean,
  ): Promise<string> {
    const payload = await this.send({ messages, json });
    return payload.text;
  }

  private async requestImage(prompt: string, image: string, mimeType: SolveImageInput["mimeType"]) {
    const payload = await this.send({
      image: { base64: image, mimeType },
      messages: [{ role: "user", content: prompt }],
      json: true,
    });
    return payload.text;
  }

  private async send(input: {
    messages: { role: "user" | "assistant" | "system"; content: string }[];
    json: boolean;
    image?: { base64: string; mimeType: SolveImageInput["mimeType"] };
  }): Promise<{ text: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      if (this.name === "openai") return await this.sendOpenAi(input, controller.signal);
      return await this.sendAnthropic(input, controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sendOpenAi(
    input: Parameters<HttpMathPathProvider["send"]>[0],
    signal: AbortSignal,
  ): Promise<{ text: string }> {
    const messages = input.messages.map((message) => {
      if (message.role !== "user" || !input.image) return message;
      return {
        role: message.role,
        content: [
          { type: "text", text: message.content },
          {
            type: "image_url",
            image_url: { url: `data:${input.image.mimeType};base64,${input.image.base64}` },
          },
        ],
      };
    });
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.2,
        ...(input.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal,
    });
    if (!response.ok) throw new AIProviderRequestError();
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new AIProviderRequestError();
    return { text };
  }

  private async sendAnthropic(
    input: Parameters<HttpMathPathProvider["send"]>[0],
    signal: AbortSignal,
  ): Promise<{ text: string }> {
    const systemMessages = input.messages.filter((message) => message.role === "system");
    const messages = input.messages
      .filter((message) => message.role !== "system")
      .map((message) => {
        if (message.role !== "user" || !input.image)
          return { role: message.role, content: message.content };
        return {
          role: message.role,
          content: [
            { type: "text", text: message.content },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: input.image.mimeType,
                data: input.image.base64,
              },
            },
          ],
        };
      });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 3000,
        system: systemMessages.map((message) => message.content).join("\n\n") || undefined,
        messages,
        ...(input.json
          ? {
              system: `${systemMessages.map((message) => message.content).join("\n\n")}\nReturn only a valid JSON object.`,
            }
          : {}),
      }),
      signal,
    });
    if (!response.ok) throw new AIProviderRequestError();
    const payload = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = payload.content?.find((item) => item.type === "text")?.text;
    if (!text) throw new AIProviderRequestError();
    return { text };
  }
}

export class AIProviderRequestError extends Error {
  constructor() {
    super("ai_provider_request_failed");
    this.name = "AIProviderRequestError";
  }
}

export class AIOutputInvalidError extends Error {
  constructor() {
    super("ai_output_invalid");
    this.name = "AIOutputInvalidError";
  }
}

export function getAIProvider(): AIProvider & { name: AIProviderName; model: string } {
  const env = readServerEnv();
  if (env.OPENAI_API_KEY)
    return new HttpMathPathProvider("openai", env.OPENAI_API_KEY, "gpt-4.1-mini");
  if (env.ANTHROPIC_API_KEY)
    return new HttpMathPathProvider(
      "anthropic",
      env.ANTHROPIC_API_KEY,
      "claude-sonnet-4-5-20250929",
    );
  throw new AIProviderNotConfiguredError("openai");
}

function solvePrompt(problem: string, locale: "vi" | "en") {
  return `${solveSystem(locale)}\n\nĐề bài do học sinh nhập:\n${problem}`;
}

function solveSystem(locale: "vi" | "en") {
  const language = locale === "vi" ? "Vietnamese" : "English";
  return `You are MathPath, a rigorous but friendly high-school mathematics tutor. Answer in ${language} only; never silently switch languages. Return a JSON object with exactly these camelCase fields: problemSummary, problemType, method, steps (array of {title,content}), verification, finalAnswer, confidenceNote (string or null). Identify given information and method, solve step by step, verify where possible, put final answer last. Preserve mathematical meaning. Never invent missing values, conditions, labels, formulas, measurements, coordinates, or figure structure. If unclear, state uncertainty clearly and ask for a clearer statement. Use delimited LaTeX such as $...$ for inline and $$...$$ for display math.`;
}

function chatSystem(locale: "vi" | "en") {
  return `You are MathPath, a friendly and rigorous high-school mathematics tutor. Answer only in ${locale === "vi" ? "Vietnamese" : "English"}. Explain concepts and math carefully, preserve math meaning, and ask a concise clarification if needed. Use $...$ for inline and $$...$$ for display math. Return JSON only: {"answer":"..."}. Do not output HTML.`;
}

function practicePrompt(input: SimilarProblemInput) {
  return `Create one genuinely new high-school math practice question, not copied or minimally paraphrased from any source. Work only on the specified skill and do not invent unsupported context. Language: ${input.locale === "vi" ? "Vietnamese" : "English"}. Topic: ${input.topic}. Difficulty: ${input.difficulty}. Skill tags: ${input.skillTags.join(", ") || "not specified"}. Source context for skill only (do not reuse wording): ${input.stem}. Create ${input.skillTags.length ? "a fresh scenario and different mathematical values" : "a complete, self-contained question"}. Return JSON only with fields statement, questionType (multiple_choice or short_answer), choices (array; empty for short answer), correctAnswer, explanation, topic, difficulty, sourceContext. For multiple choice, include correctAnswer exactly among choices. Use delimited LaTeX. Locale: ${input.locale}.`;
}

function recommendationPrompt(input: RecommendationInput) {
  const facts = JSON.stringify({
    topic: input.topic,
    accuracyPercent: input.accuracyPercent,
    targetScore: input.targetScore,
    currentAverage: input.currentAverage,
    scoreTrend: input.scoreTrend,
    attemptCount: input.attemptCount,
  });
  return `Give one short, actionable, evidence-based MathPath learning recommendation in ${input.locale === "vi" ? "Vietnamese" : "English"}. Use only these verified facts: ${facts}. Do not invent statistics or name a weak topic if topic is null. If there is insufficient data, recommend a small diagnostic practice and say why. Return JSON only: {"answer":"..."}.`;
}

function validateSolver(raw: string): SolverResponse {
  const result = solverResponseSchema.safeParse(parseJson<unknown>(raw));
  if (!result.success) throw new AIOutputInvalidError();
  const fields = [
    result.data.problemSummary,
    result.data.problemType,
    result.data.method,
    ...result.data.steps.flatMap((step) => [step.title, step.content]),
    result.data.verification,
    result.data.finalAnswer,
    result.data.confidenceNote ?? "",
  ];
  for (const field of fields) assertValidMath(field);
  return result.data;
}

function assertValidMath(value: string) {
  if (!validateMathContent(value).valid) throw new AIOutputInvalidError();
}

function parseJson<T>(value: string): T {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new AIOutputInvalidError();
  }
}
