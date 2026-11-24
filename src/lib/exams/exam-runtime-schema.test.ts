import { describe, expect, it } from "vitest";
import { examRuntimeSchema } from "./exam-runtime-schema";

describe("published exam runtime schema", () => {
  it("accepts questions whose approved image is the display content", () => {
    const runtime = examRuntimeSchema.parse({
      id: "image-backed-set",
      title: "Đề minh họa",
      description: "",
      mode: "practice",
      demo: false,
      timingMode: "elapsed",
      durationSeconds: null,
      totalScore: 1,
      sections: [],
      questions: [
        {
          id: "question-1",
          sectionId: null,
          number: null,
          type: "multiple_choice",
          stem: null,
          displayStemVi: null,
          displayStemEn: null,
          figures: [{ url: "/problem-assets/question-1.png", alt: "Question source" }],
          options: [{ key: "A", text: null, displayTextEn: null }],
          points: 1,
          correctOptionKey: "A",
        },
      ],
    });

    expect(runtime.questions[0]).toMatchObject({
      sectionId: null,
      number: null,
      stem: null,
      figures: [{ url: "/problem-assets/question-1.png" }],
      options: [{ key: "A", text: null }],
    });
  });

  it("accepts null answer metadata when no canonical answer is stored", () => {
    const parsed = examRuntimeSchema.parse({
      id: "verified-answer-set",
      title: "Ôn tập",
      description: "",
      mode: "practice",
      demo: false,
      timingMode: "elapsed",
      durationSeconds: null,
      totalScore: 1,
      sections: [],
      questions: [
        {
          id: "question-2",
          sectionId: null,
          number: null,
          type: "short_answer",
          stem: null,
          points: 1,
          canonicalAnswer: null,
          acceptedNormalizedAnswers: null,
          inputPolicy: null,
        },
      ],
    });

    expect(parsed.questions[0]).toMatchObject({
      type: "short_answer",
      canonicalAnswer: null,
      acceptedNormalizedAnswers: null,
    });
    expect(parsed.questions[0]).toHaveProperty("inputPolicy", undefined);
  });

  it("accepts numeric input policies up to the supported 256-character limit", () => {
    const parsed = examRuntimeSchema.parse({
      id: "long-numeric-answer-set",
      title: "Luyện tập",
      description: "",
      mode: "practice",
      demo: false,
      timingMode: "elapsed",
      durationSeconds: null,
      totalScore: 1,
      sections: [],
      questions: [
        {
          id: "question-3",
          sectionId: null,
          number: null,
          type: "short_answer",
          stem: "",
          points: 1,
          inputPolicy: { kind: "numeric", maxLength: 256 },
        },
      ],
    });

    expect(parsed.questions[0]).toMatchObject({
      type: "short_answer",
      inputPolicy: { kind: "numeric", maxLength: 256 },
    });
  });
});
