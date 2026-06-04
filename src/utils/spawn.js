/**
 * Promise wrapper around child_process.spawn with line-buffered callbacks.
 * Resolves with the collected stdout/stderr; rejects (with the tail of stderr)
 * on a non-zero exit. `onStdoutLine` lets a caller react to streamed progress.
 */
import { spawn } from "node:child_process";

export function run(command, args, opts = {}) {
  const { cwd, env, onStdoutLine, onStderrLine } = opts;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const lineReader = (onLine) => {
      let buf = "";
      return (chunk) => {
        buf += chunk.toString();
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (onLine) onLine(line);
        }
      };
    };

    const outReader = lineReader(onStdoutLine);
    const errReader = lineReader(onStderrLine);

    child.stdout.on("data", (c) => {
      stdout += c.toString();
      outReader(c);
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString();
      errReader(c);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else {
        const tail = stderr.trim().split("\n").slice(-15).join("\n");
        reject(
          new Error(
            `${command} ${args.join(" ")} exited ${code}\n${tail || stdout.slice(-800)}`
          )
        );
      }
    });
  });
}
