/** Keep editorial provenance in stored data, outside student-facing titles. */
export function examDisplayTitle(title: string, locale: "vi" | "en" = "vi"): string {
  const cleaned = title.replace(/\s*\(biên soạn mới\)/gi, "").trim();
  return locale === "en" ? translateExamTitle(cleaned) : cleaned;
}

function translateExamTitle(title: string): string {
  const normalized = normalizeForMatching(title);

  // Do not alter titles that are already written in English or another language.
  if (
    !/\b(?:de|thi|mon|toan|chuong|on tap|luyen tap|bo de|ma de|so gd|tich phan|dao ham|nguyen ham|xac suat|to hop)\b/i.test(
      normalized,
    )
  ) {
    return title;
  }

  const phrases: Array<[RegExp, string]> = [
    [/\b100 bai toan ren luyen tu duy cuc cao\b/gi, "100 Advanced Reasoning Problems"],
    [/\btu duy toan hoc tong hop\b/gi, "Comprehensive Mathematical Reasoning"],
    [/\bren luyen tu duy toan hoc\b/gi, "Mathematical Reasoning Practice"],
    [/\bde thi thu tot nghiep thpt nang cao\b/gi, "Advanced High School Graduation Mock Exam"],
    [/\bde thi thu tot nghiep thpt\b/gi, "High School Graduation Mock Exam"],
    [
      /\bung dung dao ham va khao sat ham so\b/gi,
      "Applications of Derivatives and Function Analysis",
    ],
    [/\bto hop\s*(?:va|[-–—:])\s*xac suat\b/gi, "Combinatorics and Probability"],
    [/\btich phan va ung dung\b/gi, "Integrals and Applications"],
    [/\bde thi thu minh hoa\b/gi, "Illustrative Mock Exam"],
    [/\bde thi thu(?: mon)? toan\b/gi, "Mathematics Mock Exam"],
    [/\bde thi tot nghiep thpt mon toan\b/gi, "High School Graduation Mathematics Exam"],
    [/\bde thi thpt quoc gia mon toan\b/gi, "National High School Graduation Mathematics Exam"],
    [/\bde thi tham khao\b/gi, "Sample Exam"],
    [/\btot nghiep thpt\b/gi, "High School Graduation"],
    [/\bde minh hoa\b/gi, "Illustrative Exam"],
    [/\bde kiem tra\b/gi, "Assessment"],
    [/\bde thi giua ky\b/gi, "Midterm Exam"],
    [/\bde thi cuoi ky\b/gi, "Final Exam"],
    [/\bde thi chinh thuc\b/gi, "Official Exam"],
    [/\bde on tap\b/gi, "Practice Exam"],
    [/\bde thi thu so\b/gi, "Mock Exam No."],
    [/\bde thi thu toan\b/gi, "Mathematics Mock Exam"],
    [/\bde thi tot nghiep thpt\b/gi, "High School Graduation Exam"],
    [/\bde thi thpt quoc gia\b/gi, "National High School Graduation Exam"],
    [/\bbo de\b/gi, "Exam Set"],
    [/\bso gd\s*&\s*dt\b/gi, "Department of Education and Training"],
    [/\btruong thpt\b/gi, "High School"],
    [/\bde thi thu\b/gi, "Mock Exam"],
    [/\bde giua ky\b/gi, "Midterm Exam"],
    [/\bde cuoi ky\b/gi, "Final Exam"],
    [/\bde so\b/gi, "Exam No."],
    [/\bde nang cao\b/gi, "Advanced Set"],
    [/\bma de\b/gi, "Version"],
    [/\bon tap ham so\b/gi, "Functions Practice"],
    [/\bon tap nguyen ham\b/gi, "Antiderivatives Practice"],
    [/\bon tap tich phan\b/gi, "Integrals Practice"],
    [/\bluyen tap tong hop\b/gi, "Comprehensive Practice"],
    [/\bon tap\b/gi, "Practice"],
    [/\bluyen tap\b/gi, "Practice"],
    [/\bren luyen tu duy\b/gi, "Reasoning Practice"],
    [/\bung dung dao ham\b/gi, "Applications of Derivatives"],
    [/\bkhao sat ham so\b/gi, "Function Analysis"],
    [/\bham so\b/gi, "Functions"],
    [/\bnguyen ham\b/gi, "Antiderivatives"],
    [/\btich phan\b/gi, "Integrals"],
    [/\bdao ham\b/gi, "Derivatives"],
    [/\bxac suat\b/gi, "Probability"],
    [/\bto hop\b/gi, "Combinatorics"],
    [/\btong hop\b/gi, "Comprehensive"],
    [/\bchuong\b/gi, "Chapter"],
    [/\bmon toan\b/gi, "Mathematics"],
    [/\bva\b/gi, "and"],
    [/\btoan\b/gi, "Mathematics"],
    [/\bthu suc\b/gi, "Practice"],
    [/\bban minh hoa\b/gi, "Illustrative Set"],
    [/\bminh hoa\b/gi, "Illustrative"],
    [/\bxem truoc\b/gi, "Preview"],
    [/\bban demo\b/gi, "Demo"],
    [/\bnam\b/gi, "Year"],
    [/\bphan\b/gi, "Part"],
    [/\bcau\b/gi, "Questions"],
    [/\bde thi\b/gi, "Exam"],
    [/\bthpt\b/gi, "High School"],
    [/\bnang cao\b/gi, "Advanced"],
    [/\bde\b/gi, "Set"],
  ];

  let translated = title;
  for (const [pattern, replacement] of phrases)
    translated = replaceNormalizedPhrase(translated, pattern, replacement);
  return translated
    .replace(/\s+/g, " ")
    .replace(/\s+([:·–—-])/g, " $1")
    .trim();
}

function normalizeForMatching(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d");
}

function replaceNormalizedPhrase(value: string, pattern: RegExp, replacement: string): string {
  const starts: number[] = [];
  const ends: number[] = [];
  let normalized = "";

  for (let originalIndex = 0; originalIndex < value.length;) {
    const character = String.fromCodePoint(value.codePointAt(originalIndex)!);
    const folded = normalizeForMatching(character);
    normalized += folded;
    for (let index = 0; index < folded.length; index += 1) {
      starts.push(originalIndex);
      ends.push(originalIndex + character.length);
    }
    originalIndex += character.length;
  }

  const matches = [...normalized.matchAll(pattern)];
  for (const match of matches.reverse()) {
    if (match.index === undefined || match[0].length === 0) continue;
    const start = starts[match.index];
    const end = ends[match.index + match[0].length - 1];
    value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  }
  return value;
}
