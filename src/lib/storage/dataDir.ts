import path from "node:path";
import os from "node:os";

function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NETLIFY,
  );
}

export function dataPath(...segments: string[]) {
  const root =
    process.env.APP_DATA_DIR ||
    (isServerlessRuntime()
      ? path.join(os.tmpdir(), "cse-training-partner", "data")
      : path.join(process.cwd(), "data"));

  return path.join(root, ...segments);
}
