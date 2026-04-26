import path from "node:path";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/").replace(/\\/g, "/");
}

export function matchesAnyGlob(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesGlob(filePath, pattern));
}

export function matchesGlob(filePath: string, pattern: string): boolean {
  const normalizedPath = toPosixPath(filePath).replace(/^\.?\//, "");
  let normalizedPattern = toPosixPath(pattern).replace(/^\.?\//, "");

  if (!normalizedPattern) {
    return false;
  }

  if (normalizedPattern.endsWith("/")) {
    normalizedPattern += "**";
  }

  const regex = globToRegExp(normalizedPattern);

  if (regex.test(normalizedPath)) {
    return true;
  }

  if (!normalizedPattern.includes("/")) {
    return regex.test(path.posix.basename(normalizedPath));
  }

  return false;
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      const afterNext = pattern[index + 2];
      if (afterNext === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegExp(char);
  }

  source += "$";
  return new RegExp(source);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
