import type {
  ProblemDifficulty,
  ProblemSetCategory,
  PublicationRightsStatus,
  PublicationStatus,
  ProvenanceStatus,
  QuestionType,
  ReviewStatus,
} from "./types";

export type ProblemSetRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  language: "vi" | "en";
  source_name: string | null;
  source_type: "official_exam" | "practice_book" | "generated" | "word_import";
  source_year: number | null;
  timing_mode: "countdown" | "elapsed";
  time_limit_seconds: number | null;
  estimated_duration_seconds: number | null;
  difficulty: ProblemDifficulty | null;
  topic: string | null;
  category: ProblemSetCategory;
  exam_metadata: Record<string, unknown>;
  scoring_config: Record<string, unknown>;
  review_status: ReviewStatus;
  publication_status: PublicationStatus;
  rights_status: PublicationRightsStatus;
  source_document_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProblemRow = {
  id: string;
  problem_set_id: string | null;
  source_reference: string | null;
  order_index: number;
  stem: string;
  display_stem_vi: string | null;
  display_stem_en: string | null;
  content_review_status: ReviewStatus;
  translation_status: "not_started" | "machine_draft" | "manually_reviewed" | "approved";
  translation_approved_at: string | null;
  translation_approved_by: string | null;
  edited_at: string | null;
  edited_by: string | null;
  content_approved_at: string | null;
  content_approved_by: string | null;
  topic: string | null;
  subtopic: string | null;
  difficulty: Exclude<ProblemDifficulty, "mixed"> | null;
  source_page: number | null;
  question_type: QuestionType;
  question_number: string | null;
  section_id: string | null;
  topic_id: string | null;
  source_document_id: string | null;
  source_question_number: string | null;
  provenance_status: ProvenanceStatus;
  review_status: ReviewStatus;
  publication_status: PublicationStatus;
  rights_status: PublicationRightsStatus;
  created_at: string;
  updated_at: string;
};

export type ProblemOptionRow = {
  id: string;
  problem_id: string;
  option_key: string;
  option_text: string;
  display_text_vi: string | null;
  display_text_en: string | null;
  order_index: number;
  created_at: string;
};

export type ProblemSubstatementRow = {
  id: string;
  problem_id: string;
  statement_key: string;
  statement_text: string;
  display_text_vi: string | null;
  display_text_en: string | null;
  order_index: number;
  created_at: string;
};

export type ProblemSetSectionRow = {
  id: string;
  problem_set_id: string;
  section_key: string;
  title: string;
  order_index: number;
  created_at: string;
};

export type ProblemTopicRow = {
  id: string;
  slug: string;
  name_vi: string;
  name_en: string | null;
  parent_id: string | null;
  is_active: boolean;
  order_index: number;
};

export type ProblemTagRow = {
  id: string;
  slug: string;
  name_vi: string;
  name_en: string | null;
  created_at: string;
};

export type ProblemTagAssignmentRow = {
  problem_id: string;
  tag_id: string;
  tag_kind: "content" | "similar_practice";
};

export type ProblemSourceDocumentRow = {
  id: string;
  document_name: string;
  source_type: "official_exam" | "practice_book" | "generated" | "other";
  source_year: number | null;
  provenance_status: ProvenanceStatus;
  publication_rights_status: PublicationRightsStatus;
  provenance_note: string | null;
  source_fingerprint: string | null;
  created_at: string;
};

export type PracticeSessionRow = {
  id: string;
  user_id: string | null;
  guest_session_hash: string | null;
  topic_id: string;
  idempotency_key: string;
  status: "in_progress" | "submitted" | "expired";
  created_at: string;
  updated_at: string;
};

export type PracticeSessionQuestionRow = {
  session_id: string;
  problem_id: string;
  order_index: number;
  selected_at: string;
};

/** This table belongs to the private schema and must only be queried server-side. */
export type ProblemAnswerKeyRow = {
  problem_id: string;
  correct_answer: Record<string, unknown>;
  verification_status: "unverified" | "verified" | "uncertain";
  verified_by: string | null;
  verified_at: string | null;
  provenance_note: string | null;
  updated_at: string;
};

export type ExamAttemptRow = {
  id: string;
  user_id: string | null;
  guest_session_hash: string | null;
  problem_set_id: string | null;
  status: "not_started" | "in_progress" | "submitted" | "auto_submitted" | "expired" | "abandoned";
  exam_mode: "official_thptqg" | "practice" | "school_mock";
  timing_mode: "countdown" | "elapsed";
  time_limit_seconds: number | null;
  deadline_at: string | null;
  idempotency_key: string;
  submission_request_id: string | null;
  submission_reason: "manual" | "auto" | null;
  exam_configuration_snapshot: Record<string, unknown>;
  selected_problem_ids: string[];
  score: number | null;
  correct_count: number;
  wrong_count: number;
  blank_count: number;
  duration_seconds: number | null;
  started_at: string;
  submitted_at: string | null;
  last_activity_at: string;
  created_at: string;
};

export type AttemptQuestionRow = {
  attempt_id: string;
  problem_id: string;
  section_id: string | null;
  order_index: number;
  points: number;
  scoring_rule: Record<string, unknown>;
};

export type AttemptAnswerRow = {
  id: string;
  attempt_id: string;
  problem_id: string;
  selected_answer: Record<string, unknown> | null;
  is_correct: boolean | null;
  marked_for_review: boolean;
  answered_at: string | null;
  updated_at: string;
  revision: number;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/** Minimal generated-style schema typing for the tables used by server repositories. */
export type Database = {
  public: {
    Tables: {
      profiles: Table<{
        id: string;
        display_name: string | null;
        language: "vi" | "en";
        target_score: number | null;
        role: "student" | "admin";
        created_at: string;
        updated_at: string;
      }>;
      problem_sets: Table<ProblemSetRow>;
      problems: Table<ProblemRow>;
      problem_options: Table<ProblemOptionRow>;
      problem_substatements: Table<ProblemSubstatementRow>;
      problem_set_sections: Table<ProblemSetSectionRow>;
      attempts: Table<ExamAttemptRow>;
      attempt_questions: Table<AttemptQuestionRow>;
      attempt_answers: Table<AttemptAnswerRow>;
      ai_practice_items: Table<{
        id: string;
        user_id: string | null;
        guest_session_hash: string | null;
        statement: string;
        question_type: "multiple_choice" | "short_answer";
        choices: Json;
        correct_answer: string;
        explanation: string;
        topic: string;
        difficulty: "easy" | "medium" | "hard";
        source_context: string;
        provider: string;
        model: string;
        created_at: string;
        expires_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      get_exam_runtime: { Args: { p_slug: string }; Returns: Json };
      find_current_exam_attempt: {
        Args: { p_user_id: string | null; p_guest_session_hash: string | null; p_slug: string };
        Returns: string | null;
      };
      start_exam_attempt: {
        Args: {
          p_user_id: string | null;
          p_guest_session_hash: string | null;
          p_slug: string;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      get_exam_attempt: {
        Args: {
          p_attempt_id: string;
          p_user_id: string | null;
          p_guest_session_hash: string | null;
        };
        Returns: Json;
      };
      save_exam_attempt_state: {
        Args: {
          p_attempt_id: string;
          p_user_id: string | null;
          p_guest_session_hash: string | null;
          p_problem_id: string;
          p_selected_answer: Json;
          p_marked_for_review: boolean;
        };
        Returns: Json;
      };
      submit_exam_attempt: {
        Args: {
          p_attempt_id: string;
          p_user_id: string | null;
          p_guest_session_hash: string | null;
          p_request_id: string;
          p_reason: "manual" | "auto";
          p_result_payload: Json;
        };
        Returns: Json;
      };
      claim_exam_attempt_submission: {
        Args: {
          p_attempt_id: string;
          p_user_id: string | null;
          p_guest_session_hash: string | null;
          p_request_id: string;
          p_reason: "manual" | "auto";
        };
        Returns: boolean;
      };
      claim_guest_attempts: {
        Args: { p_guest_session_hash: string; p_user_id: string };
        Returns: number;
      };
      get_guest_question_usage: {
        Args: { p_guest_session_hash: string };
        Returns: number;
      };
      get_student_progress: {
        Args: { p_user_id: string; p_history_limit?: number; p_history_offset?: number };
        Returns: Json;
      };
      get_student_attempt_result: {
        Args: { p_user_id: string; p_attempt_id: string };
        Returns: Json;
      };
      get_admin_analytics: {
        Args: { p_actor_user_id: string };
        Returns: Json;
      };
      abandon_exam_attempt: {
        Args: {
          p_attempt_id: string;
          p_user_id: string | null;
          p_guest_session_hash: string | null;
        };
        Returns: boolean;
      };
      seed_demo_exams: { Args: { p_exams: Json }; Returns: number };
      get_ai_quota: {
        Args: { p_user_id: string | null; p_guest_session_hash: string | null };
        Returns: Json;
      };
      reserve_ai_request: {
        Args: {
          p_user_id: string | null;
          p_guest_session_hash: string | null;
          p_request_id: string;
          p_request_type: string;
          p_input_type: string;
          p_provider: string;
          p_model: string;
        };
        Returns: Json;
      };
      finish_ai_request: {
        Args: {
          p_reservation_id: string;
          p_usage_id: string;
          p_succeeded: boolean;
          p_duration_ms: number;
          p_input_tokens?: number | null;
          p_output_tokens?: number | null;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
