export type MentorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type MentorRequest = {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export type MentorResponse = {
  success: boolean;
  message?: string;
  error?: string;
};