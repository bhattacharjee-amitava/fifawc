import data from "./quiz.json";

/** Option keys as used in the JSON. */
export type OptionKey = "A" | "B" | "C" | "D";

export interface QuizQuestion {
  id: number;
  category: string;
  question: string;
  options: Record<OptionKey, string>;
  correct_answer: OptionKey;
  explanation: string;
}

export interface Quiz {
  quiz_title: string;
  total_questions: number;
  categories: string[];
  questions: QuizQuestion[];
}

export const QUIZ = data as Quiz;
export const QUIZ_QUESTIONS = QUIZ.questions;

/** Stable, ordered option keys for rendering. */
export const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];
