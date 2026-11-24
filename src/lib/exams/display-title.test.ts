import { describe, it, expect } from "vitest";
import { examDisplayTitle } from "./display-title";

describe("student-facing exam title", () => {
  it("removes the editorial suffix without changing the exam identity", () => {
    expect(examDisplayTitle("Đề thi thử Toán 03 – MathPath (biên soạn mới)")).toBe(
      "Đề thi thử Toán 03 – MathPath",
    );
  });
  it("keeps other parentheses and titles intact", () => {
    expect(examDisplayTitle("Ôn tập (chương 1)")).toBe("Ôn tập (chương 1)");
  });

  it("shows exam titles in English when the site locale is English", () => {
    expect(examDisplayTitle("Đề thi thử Toán 03 – MathPath (biên soạn mới)", "en")).toBe(
      "Mathematics Mock Exam 03 – MathPath",
    );
    expect(examDisplayTitle("ĐỀ SỐ 01", "en")).toBe("Exam No. 01");
    expect(examDisplayTitle("Đề thi thử tốt nghiệp THPT · Mã đề 03", "en")).toBe(
      "High School Graduation Mock Exam · Version 03",
    );
    expect(examDisplayTitle("Ứng dụng đạo hàm và khảo sát hàm số · Đề nâng cao 01", "en")).toBe(
      "Applications of Derivatives and Function Analysis · Advanced Set 01",
    );
    expect(examDisplayTitle("Rèn luyện tư duy toán học · Đề nâng cao 02", "en")).toBe(
      "Mathematical Reasoning Practice · Advanced Set 02",
    );
    expect(examDisplayTitle("Tư duy toán học tổng hợp – Practice Exam 1", "en")).toBe(
      "Comprehensive Mathematical Reasoning – Practice Exam 1",
    );
    expect(examDisplayTitle("Tổ hợp và xác suất · Đề nâng cao 04", "en")).toBe(
      "Combinatorics and Probability · Advanced Set 04",
    );
    expect(examDisplayTitle("Tích phân và ứng dụng · Đề nâng cao 03", "en")).toBe(
      "Integrals and Applications · Advanced Set 03",
    );
    expect(examDisplayTitle("Tổ hợp - Xác suất – Đề 02", "en")).toBe(
      "Combinatorics and Probability – Set 02",
    );
    expect(examDisplayTitle("Tích phân và ứng dụng – Đề 03", "en")).toBe(
      "Integrals and Applications – Set 03",
    );
    expect(examDisplayTitle("100 bài toán rèn luyện tư duy cực cao – Đề 02", "en")).toBe(
      "100 Advanced Reasoning Problems – Set 02",
    );
  });

  it("leaves titles that are already English unchanged", () => {
    expect(examDisplayTitle("Model Derivatives Practice — Set 02", "en")).toBe(
      "Model Derivatives Practice — Set 02",
    );
  });

  it("translates common exam source labels", () => {
    expect(examDisplayTitle("Đề thi tham khảo môn Toán năm 2025", "en")).toBe(
      "Sample Exam Mathematics Year 2025",
    );
  });
});
