// Supabase 프로젝트 연결 후 `supabase gen types typescript`로 재생성 권장.
// 지금은 supabase/migrations/0001_init.sql 스키마를 손으로 맞춘 타입.
//
// 주의: 아래 Row 타입들은 반드시 `interface`가 아닌 `type`으로 선언해야 한다.
// TypeScript에서 interface는 Record<string, unknown> 같은 인덱스 시그니처 타입에
// `extends`되지 않아 (구조적으로 동일해도) Supabase의 GenericSchema 제약을 통과하지
// 못하고 모든 쿼리 결과가 `never`로 무너지는 문제가 있다.

export type Role = "teacher" | "student" | "admin";
export type ScoringType = "numeric" | "label";
export type AssignmentStatus = "draft" | "open" | "closed";
export type CriteriaSourceType = "text" | "file";
export type ExtractionStatus = "pending" | "ok" | "failed";
export type GradingStatus = "pending" | "graded" | "reviewed";
export type QuizQuestionType = "multiple" | "subjective";
export type QuizQuestionStatus = "pending_review" | "published";

export type Profile = {
  id: string;
  role: Role;
  display_name: string;
  school_name: string | null;
  created_at: string;
};

export type ClassRow = {
  id: string;
  teacher_id: string;
  name: string;
  join_code: string;
  created_at: string;
};

export type ClassEnrollment = {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
};

export type Assignment = {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  subject: string | null;
  description: string | null;
  due_at: string | null;
  scoring_type: ScoringType;
  status: AssignmentStatus;
  created_at: string;
};

export type GradingCriteria = {
  id: string;
  assignment_id: string;
  criteria_text: string | null;
  source_type: CriteriaSourceType;
  file_path: string | null;
  file_mime: string | null;
  created_at: string;
  updated_at: string;
};

export type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  file_path: string;
  file_mime: string;
  original_filename: string;
  extracted_text: string | null;
  extraction_status: ExtractionStatus;
  submitted_at: string;
};

export type GradingResult = {
  id: string;
  submission_id: string;
  score: number | null;
  score_label: string | null;
  ai_feedback: string | null;
  ai_septeuk: string | null;
  ai_rationale: string | null;
  final_score: number | null;
  final_feedback: string | null;
  final_septeuk: string | null;
  status: GradingStatus;
  visible_to_student: boolean;
  raw_model_response: unknown;
  model_name: string | null;
  graded_at: string | null;
  reviewed_at: string | null;
};

export type QuizQuestion = {
  id: string;
  class_id: string;
  teacher_id: string;
  unit: string;
  type: QuizQuestionType;
  content: string;
  options: string[] | null;
  answer: string;
  difficulty: number;
  concept_keyword: string | null;
  status: QuizQuestionStatus;
  source_pdf_path: string | null;
  source_page: number | null;
  image_path: string | null;
  created_at: string;
};

export type QuizAttempt = {
  id: string;
  question_id: string;
  student_id: string;
  class_id: string;
  submitted_answer: string | null;
  is_correct: boolean;
  difficulty_at_attempt: number;
  ai_feedback: string | null;
  teacher_feedback: string | null;
  created_at: string;
};

export type QuizConceptReview = {
  id: string;
  student_id: string;
  class_id: string;
  unit: string;
  keyword: string;
  explanation: string;
  created_at: string;
};

export type QuizClassAnalysis = {
  id: string;
  class_id: string;
  signature: string;
  analysis: string;
  updated_at: string;
};

export type ClassAnnouncement = {
  id: string;
  class_id: string;
  teacher_id: string;
  body: string;
  created_at: string;
};

export type QuizStudentFeedback = {
  id: string;
  class_id: string;
  student_id: string;
  teacher_id: string;
  feedback: string;
  created_at: string;
  updated_at: string;
};

export type StudentGradingResultView = {
  id: string;
  submission_id: string;
  assignment_id: string;
  student_id: string;
  score: number | null;
  score_label: string | null;
  feedback: string | null;
  status: GradingStatus;
  reviewed_at: string | null;
};

type Relationships = never[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; role: Role };
        Update: Partial<Profile>;
        Relationships: Relationships;
      };
      classes: {
        Row: ClassRow;
        Insert: Partial<ClassRow> & { teacher_id: string; name: string; join_code: string };
        Update: Partial<ClassRow>;
        Relationships: Relationships;
      };
      class_enrollments: {
        Row: ClassEnrollment;
        Insert: Partial<ClassEnrollment> & { class_id: string; student_id: string };
        Update: Partial<ClassEnrollment>;
        Relationships: Relationships;
      };
      assignments: {
        Row: Assignment;
        Insert: Partial<Assignment> & { class_id: string; teacher_id: string; title: string };
        Update: Partial<Assignment>;
        Relationships: Relationships;
      };
      grading_criteria: {
        Row: GradingCriteria;
        Insert: Partial<GradingCriteria> & { assignment_id: string; source_type: CriteriaSourceType };
        Update: Partial<GradingCriteria>;
        Relationships: Relationships;
      };
      submissions: {
        Row: Submission;
        Insert: Partial<Submission> & {
          assignment_id: string;
          student_id: string;
          file_path: string;
          file_mime: string;
          original_filename: string;
        };
        Update: Partial<Submission>;
        Relationships: Relationships;
      };
      grading_results: {
        Row: GradingResult;
        Insert: Partial<GradingResult> & { submission_id: string };
        Update: Partial<GradingResult>;
        Relationships: Relationships;
      };
      quiz_questions: {
        Row: QuizQuestion;
        Insert: Partial<QuizQuestion> & {
          class_id: string;
          teacher_id: string;
          unit: string;
          type: QuizQuestionType;
          content: string;
          answer: string;
        };
        Update: Partial<QuizQuestion>;
        Relationships: Relationships;
      };
      quiz_attempts: {
        Row: QuizAttempt;
        Insert: Partial<QuizAttempt> & {
          question_id: string;
          student_id: string;
          class_id: string;
          is_correct: boolean;
          difficulty_at_attempt: number;
        };
        Update: Partial<QuizAttempt>;
        Relationships: Relationships;
      };
      quiz_concept_reviews: {
        Row: QuizConceptReview;
        Insert: Partial<QuizConceptReview> & {
          student_id: string;
          class_id: string;
          unit: string;
          keyword: string;
          explanation: string;
        };
        Update: Partial<QuizConceptReview>;
        Relationships: Relationships;
      };
      quiz_student_feedback: {
        Row: QuizStudentFeedback;
        Insert: Partial<QuizStudentFeedback> & {
          class_id: string;
          student_id: string;
          teacher_id: string;
          feedback: string;
        };
        Update: Partial<QuizStudentFeedback>;
        Relationships: Relationships;
      };
      class_announcements: {
        Row: ClassAnnouncement;
        Insert: Partial<ClassAnnouncement> & { class_id: string; teacher_id: string; body: string };
        Update: Partial<ClassAnnouncement>;
        Relationships: Relationships;
      };
      quiz_class_analysis: {
        Row: QuizClassAnalysis;
        Insert: Partial<QuizClassAnalysis> & { class_id: string; signature: string; analysis: string };
        Update: Partial<QuizClassAnalysis>;
        Relationships: Relationships;
      };
    };
    Views: {
      student_grading_results: { Row: StudentGradingResultView; Relationships: Relationships };
    };
    Functions: Record<string, never>;
  };
};
