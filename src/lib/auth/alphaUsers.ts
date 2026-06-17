import type { MockRole } from "@/lib/types";

export type AlphaUser = {
  id: string;
  email: string;
  name: string;
  role: MockRole;
  password: string;
};

function alphaValue(envName: string, localFallback: string) {
  if (process.env.NODE_ENV === "production") {
    return process.env[envName] ?? "";
  }

  return process.env[envName] || localFallback;
}

// TODO: Replace alpha users with persistent user management and hashed passwords.
export const alphaUsers: AlphaUser[] = [
  {
    id: "alpha-root-admin",
    email: alphaValue("ALPHA_ROOT_ADMIN_EMAIL", "root.admin@cse.local"),
    name: "Root Admin",
    role: "root_admin",
    password: alphaValue("ALPHA_ROOT_ADMIN_PASSWORD", "P@ssword1"),
  },
  {
    id: "alpha-course-admin",
    email: alphaValue("ALPHA_COURSE_ADMIN_EMAIL", "course.admin@cse.local"),
    name: "Course Admin",
    role: "course_admin",
    password: alphaValue("ALPHA_COURSE_ADMIN_PASSWORD", "P@ssword1"),
  },
  {
    id: "alpha-trainee-1",
    email: alphaValue("ALPHA_TRAINEE_1_EMAIL", "trainee1@cse.local"),
    name: "Manny Pacquiao",
    role: "trainee",
    password: alphaValue("ALPHA_TRAINEE_1_PASSWORD", "P@ssword1"),
  },
  {
    id: "alpha-trainee-2",
    email: alphaValue("ALPHA_TRAINEE_2_EMAIL", "trainee2@cse.local"),
    name: "Ben Reilly",
    role: "trainee",
    password: alphaValue("ALPHA_TRAINEE_2_PASSWORD", "P@ssword1"),
  },
];

export function findAlphaUserByCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return alphaUsers.find(
    (user) => user.email === normalizedEmail && user.password && user.password === password,
  );
}

export function findAlphaUserById(userId: string) {
  return alphaUsers.find((user) => user.id === userId);
}
