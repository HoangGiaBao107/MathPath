export type AppRole = "student" | "admin";

export type AuthenticatedActor = {
  userId: string;
  role: AppRole;
};

export type AuthProvider = "email" | "google" | "phone";

export type AuthArchitecture = {
  provider: "supabase";
  supportedMethods: readonly AuthProvider[];
  sessionStorage: "http-only-cookie";
};

export const authArchitecture: AuthArchitecture = {
  provider: "supabase",
  supportedMethods: ["email", "google"],
  sessionStorage: "http-only-cookie",
};
