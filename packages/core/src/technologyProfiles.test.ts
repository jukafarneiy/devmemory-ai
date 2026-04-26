import { describe, expect, it } from "vitest";
import {
  buildExcludePatternsForProfiles,
  buildIncludePatternsForProfiles,
  detectTechnologyProfiles
} from "./technologyProfiles";

function detectIds(files: string[]): string[] {
  return detectTechnologyProfiles(files).map((profile) => profile.id);
}

describe("detectTechnologyProfiles", () => {
  it("detects node from package.json", () => {
    expect(detectIds(["package.json"])).toContain("node");
  });

  it("detects node from lockfiles too", () => {
    expect(detectIds(["pnpm-lock.yaml"])).toContain("node");
    expect(detectIds(["yarn.lock"])).toContain("node");
  });

  it("detects python from requirements.txt", () => {
    expect(detectIds(["requirements.txt"])).toContain("python");
  });

  it("detects python from pyproject.toml and manage.py", () => {
    expect(detectIds(["pyproject.toml"])).toContain("python");
    expect(detectIds(["manage.py"])).toContain("python");
  });

  it("detects php from composer.json", () => {
    expect(detectIds(["composer.json"])).toContain("php");
  });

  it("detects ruby from Gemfile", () => {
    expect(detectIds(["Gemfile"])).toContain("ruby");
  });

  it("detects java from pom.xml and build.gradle", () => {
    expect(detectIds(["pom.xml"])).toContain("java");
    expect(detectIds(["build.gradle"])).toContain("java");
  });

  it("detects dotnet from a .csproj file", () => {
    expect(detectIds(["src/MyApp.csproj"])).toContain("dotnet");
    expect(detectIds(["solution.sln"])).toContain("dotnet");
  });

  it("detects go from go.mod", () => {
    expect(detectIds(["go.mod"])).toContain("go");
  });

  it("detects rust from Cargo.toml", () => {
    expect(detectIds(["Cargo.toml"])).toContain("rust");
  });

  it("detects flutter from pubspec.yaml", () => {
    expect(detectIds(["pubspec.yaml"])).toContain("flutter");
  });

  it("detects multiple stacks in a polyglot repo", () => {
    const ids = detectIds(["package.json", "requirements.txt", "go.mod"]);
    expect(ids).toEqual(expect.arrayContaining(["node", "python", "go"]));
  });

  it("returns empty when no signals match", () => {
    expect(detectTechnologyProfiles(["random.txt", "notes.md"])).toEqual([]);
  });
});

describe("buildIncludePatternsForProfiles / buildExcludePatternsForProfiles", () => {
  it("merges include patterns across detected profiles without duplicates", () => {
    const profiles = detectTechnologyProfiles(["package.json", "go.mod"]);
    const includes = buildIncludePatternsForProfiles(profiles);
    const unique = new Set(includes);
    expect(includes.length).toBe(unique.size);
    expect(includes).toContain("package.json");
    expect(includes).toContain("go.mod");
  });

  it("merges exclude patterns and keeps stack-specific build outputs", () => {
    const profiles = detectTechnologyProfiles(["Cargo.toml", "build.gradle"]);
    const excludes = buildExcludePatternsForProfiles(profiles);
    expect(excludes).toContain("target/**");
    expect(excludes).toContain(".gradle/**");
  });

  it("returns empty arrays when no profiles are detected", () => {
    const profiles = detectTechnologyProfiles(["nothing-here.txt"]);
    expect(buildIncludePatternsForProfiles(profiles)).toEqual([]);
    expect(buildExcludePatternsForProfiles(profiles)).toEqual([]);
  });
});
