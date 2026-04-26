import { describe, expect, it } from "vitest";
import { DEFAULT_EXCLUDE_PATTERNS, DEFAULT_INCLUDE_PATTERNS } from "./defaults";
import { matchesAnyGlob } from "./glob";
import {
  buildIncludePatternsForProfiles,
  detectTechnologyProfiles
} from "./technologyProfiles";

describe("default safety exclusions", () => {
  it("blocks environment and credential-like files", () => {
    expect(matchesAnyGlob(".env", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("apps/api/.env.local", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("private.pem", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("config/credentials.json", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("certs/server.key", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
  });

  it("blocks local database files", () => {
    expect(matchesAnyGlob("data.db", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("storage/app.sqlite", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("storage/app.sqlite3", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
  });

  it("blocks generated and dependency folders across stacks", () => {
    expect(matchesAnyGlob("node_modules/pkg/index.js", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("apps/web/node_modules/pkg/index.js", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("dist/index.js", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("packages/core/dist/index.js", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("build/output.js", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("vendor/bundle/index.rb", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob(".venv/lib/python.py", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("__pycache__/cache.pyc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("apps/api/__pycache__/cache.pyc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("uploads/photo.png", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("instance/app.cfg", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("target/release/app", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("bin/Release/app.exe", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("obj/Debug/app.obj", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob(".git/config", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
  });

  it("blocks language and package manager credentials", () => {
    expect(matchesAnyGlob(".npmrc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("apps/web/.npmrc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob(".yarnrc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("packages/core/.yarnrc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob(".pypirc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("services/api/.pypirc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob(".netrc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("home/user/.netrc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
  });

  it("blocks cloud provider and cluster credentials", () => {
    expect(matchesAnyGlob(".aws/credentials", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("home/user/.aws/credentials", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob(".ssh/id_rsa", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("home/user/.ssh/id_ed25519", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob(".kube/config", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("infra/.kube/config", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("kubeconfig", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("infra/kubeconfig", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
  });

  it("blocks WordPress and Rails master credentials", () => {
    expect(matchesAnyGlob("wp-config.php", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("public/wp-config.php", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("config/master.key", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("apps/api/config/master.key", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("config/credentials.yml.enc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("apps/api/config/credentials.yml.enc", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
  });

  it("blocks Terraform state and variable files", () => {
    expect(matchesAnyGlob("terraform.tfstate", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("infra/terraform.tfstate", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("terraform.tfstate.backup", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("infra/terraform.tfstate.backup", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("prod.tfvars", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("infra/prod.tfvars", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
  });

  it("blocks mobile app secrets and signing material", () => {
    expect(matchesAnyGlob("release.keystore", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("android/app/release.keystore", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("google-services.json", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("android/app/google-services.json", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("GoogleService-Info.plist", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("ios/Runner/GoogleService-Info.plist", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("serviceAccount.json", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("serviceAccountKey.json", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("infra/serviceAccount-prod.json", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("myapp-firebase-adminsdk-abc123.json", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("secrets/app-firebase-adminsdk.json", DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
  });

  it("allows globally-safe documentation and source paths", () => {
    expect(matchesAnyGlob("README.md", DEFAULT_EXCLUDE_PATTERNS)).toBe(false);
    expect(matchesAnyGlob("docs/product.md", DEFAULT_EXCLUDE_PATTERNS)).toBe(false);
    expect(matchesAnyGlob("src/index.ts", DEFAULT_EXCLUDE_PATTERNS)).toBe(false);
  });

  it("includes README and docs globally", () => {
    expect(matchesAnyGlob("README.md", DEFAULT_INCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob("docs/product.md", DEFAULT_INCLUDE_PATTERNS)).toBe(true);
    expect(matchesAnyGlob(".github/workflows/ci.yml", DEFAULT_INCLUDE_PATTERNS)).toBe(true);
  });
});

describe("per-profile important files are included", () => {
  function includesFor(signalPath: string): string[] {
    const profiles = detectTechnologyProfiles([signalPath]);
    return buildIncludePatternsForProfiles(profiles);
  }

  it("Node profile includes package.json, tsconfig.json and src files", () => {
    const includes = includesFor("package.json");
    expect(matchesAnyGlob("package.json", includes)).toBe(true);
    expect(matchesAnyGlob("src/index.ts", includes)).toBe(true);
    expect(matchesAnyGlob("tsconfig.json", includes)).toBe(true);
  });

  it("Python profile includes requirements.txt, pyproject.toml and app code", () => {
    const includes = includesFor("requirements.txt");
    expect(matchesAnyGlob("requirements.txt", includes)).toBe(true);
    expect(matchesAnyGlob("app.py", includes)).toBe(true);
    const pyprojectIncludes = includesFor("pyproject.toml");
    expect(matchesAnyGlob("pyproject.toml", pyprojectIncludes)).toBe(true);
  });

  it("PHP profile includes composer.json, artisan and controller code", () => {
    const includes = includesFor("composer.json");
    expect(matchesAnyGlob("composer.json", includes)).toBe(true);
    expect(matchesAnyGlob("app/Http/Controllers/HomeController.php", includes)).toBe(true);
    const artisanIncludes = includesFor("artisan");
    expect(matchesAnyGlob("artisan", artisanIncludes)).toBe(true);
  });

  it("PHP profile is not detected solely by wp-config.php (kept out of signals)", () => {
    expect(detectTechnologyProfiles(["wp-config.php"]).map((profile) => profile.id)).not.toContain("php");
  });

  it("Ruby profile includes Gemfile", () => {
    const includes = includesFor("Gemfile");
    expect(matchesAnyGlob("Gemfile", includes)).toBe(true);
  });

  it("Java profile includes pom.xml and build.gradle", () => {
    expect(matchesAnyGlob("pom.xml", includesFor("pom.xml"))).toBe(true);
    expect(matchesAnyGlob("build.gradle", includesFor("build.gradle"))).toBe(true);
  });

  it(".NET profile includes *.csproj", () => {
    const includes = includesFor("MyApp.csproj");
    expect(matchesAnyGlob("MyApp.csproj", includes)).toBe(true);
  });

  it("Go profile includes go.mod", () => {
    const includes = includesFor("go.mod");
    expect(matchesAnyGlob("go.mod", includes)).toBe(true);
  });

  it("Rust profile includes Cargo.toml", () => {
    const includes = includesFor("Cargo.toml");
    expect(matchesAnyGlob("Cargo.toml", includes)).toBe(true);
  });

  it("Flutter profile includes pubspec.yaml", () => {
    const includes = includesFor("pubspec.yaml");
    expect(matchesAnyGlob("pubspec.yaml", includes)).toBe(true);
  });
});
