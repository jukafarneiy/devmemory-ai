import { matchesAnyGlob } from "./glob";

export interface TechnologyProfile {
  id: string;
  label: string;
  signals: string[];
  include: string[];
  exclude: string[];
}

export const DEFAULT_TECHNOLOGY_PROFILES: TechnologyProfile[] = [
  {
    id: "node",
    label: "Node.js / JavaScript / TypeScript",
    signals: [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "pnpm-workspace.yaml",
      "tsconfig.json"
    ],
    include: [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "pnpm-workspace.yaml",
      "tsconfig.json",
      "tsconfig.*.json",
      "src/**/*",
      "app/**/*",
      "pages/**/*",
      "components/**/*",
      "lib/**/*",
      "public/**/*",
      "tests/**/*",
      "test/**/*",
      "apps/**/*",
      "packages/**/*"
    ],
    exclude: [
      "node_modules/**",
      "**/node_modules/**",
      "dist/**",
      "**/dist/**",
      "build/**",
      "**/build/**",
      ".next/**",
      "**/.next/**",
      ".nuxt/**",
      "**/.nuxt/**",
      ".svelte-kit/**",
      "**/.svelte-kit/**",
      ".turbo/**",
      "**/.turbo/**",
      ".cache/**",
      "**/.cache/**",
      "coverage/**",
      "**/coverage/**"
    ]
  },
  {
    id: "python",
    label: "Python",
    signals: [
      "requirements.txt",
      "pyproject.toml",
      "setup.py",
      "setup.cfg",
      "Pipfile",
      "app.py",
      "manage.py",
      "wsgi.py",
      "asgi.py"
    ],
    include: [
      "requirements.txt",
      "requirements-*.txt",
      "pyproject.toml",
      "setup.py",
      "setup.cfg",
      "Pipfile",
      "Pipfile.lock",
      "manage.py",
      "app.py",
      "wsgi.py",
      "asgi.py",
      "**/*.py",
      "app/**/*",
      "src/**/*",
      "templates/**/*",
      "static/**/*",
      "tests/**/*",
      "test/**/*"
    ],
    exclude: [
      ".venv/**",
      "**/.venv/**",
      "venv/**",
      "**/venv/**",
      "__pycache__/**",
      "**/__pycache__/**",
      ".pytest_cache/**",
      "**/.pytest_cache/**",
      ".mypy_cache/**",
      "**/.mypy_cache/**",
      ".ruff_cache/**",
      "**/.ruff_cache/**",
      "*.pyc",
      "*.pyo",
      "instance/**",
      "**/instance/**",
      "uploads/**",
      "**/uploads/**"
    ]
  },
  {
    id: "php",
    label: "PHP",
    signals: ["composer.json", "composer.lock", "artisan", "symfony.lock"],
    include: [
      "composer.json",
      "composer.lock",
      "artisan",
      "**/*.php",
      "app/**/*",
      "routes/**/*",
      "resources/**/*",
      "public/**/*",
      "config/**/*",
      "database/migrations/**/*",
      "src/**/*",
      "tests/**/*"
    ],
    exclude: [
      "vendor/**",
      "**/vendor/**",
      "storage/logs/**",
      "**/storage/logs/**",
      "storage/framework/**",
      "**/storage/framework/**",
      "bootstrap/cache/**",
      "**/bootstrap/cache/**",
      "uploads/**",
      "**/uploads/**"
    ]
  },
  {
    id: "ruby",
    label: "Ruby / Rails",
    signals: ["Gemfile", "Gemfile.lock", "config.ru", "Rakefile"],
    include: [
      "Gemfile",
      "Gemfile.lock",
      "Rakefile",
      "config.ru",
      "**/*.rb",
      "app/**/*",
      "config/**/*",
      "db/migrate/**/*",
      "lib/**/*",
      "spec/**/*",
      "test/**/*"
    ],
    exclude: [
      "vendor/bundle/**",
      "**/vendor/bundle/**",
      "tmp/**",
      "**/tmp/**",
      "log/**",
      "**/log/**"
    ]
  },
  {
    id: "java",
    label: "Java / Kotlin (Maven/Gradle)",
    signals: ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"],
    include: [
      "pom.xml",
      "build.gradle",
      "build.gradle.kts",
      "settings.gradle",
      "settings.gradle.kts",
      "gradle.properties",
      "src/main/**/*",
      "src/test/**/*",
      "app/src/main/**/*",
      "app/src/test/**/*",
      "AndroidManifest.xml",
      "**/AndroidManifest.xml"
    ],
    exclude: [
      "target/**",
      "**/target/**",
      "build/**",
      "**/build/**",
      ".gradle/**",
      "**/.gradle/**",
      ".idea/**",
      "**/.idea/**"
    ]
  },
  {
    id: "dotnet",
    label: ".NET / C#",
    signals: ["*.csproj", "*.sln", "*.fsproj", "*.vbproj", "global.json"],
    include: [
      "*.sln",
      "**/*.sln",
      "*.csproj",
      "**/*.csproj",
      "*.fsproj",
      "**/*.fsproj",
      "global.json",
      "Directory.Build.props",
      "src/**/*",
      "test/**/*",
      "tests/**/*",
      "**/*.cs",
      "**/*.fs",
      "**/*.razor",
      "**/*.cshtml"
    ],
    exclude: [
      "bin/**",
      "**/bin/**",
      "obj/**",
      "**/obj/**",
      "packages/**/*.nupkg"
    ]
  },
  {
    id: "go",
    label: "Go",
    signals: ["go.mod", "go.sum"],
    include: ["go.mod", "go.sum", "**/*.go", "cmd/**/*", "internal/**/*", "pkg/**/*"],
    exclude: ["vendor/**", "**/vendor/**", "bin/**", "**/bin/**"]
  },
  {
    id: "rust",
    label: "Rust",
    signals: ["Cargo.toml", "Cargo.lock"],
    include: ["Cargo.toml", "Cargo.lock", "src/**/*", "tests/**/*", "benches/**/*", "examples/**/*"],
    exclude: ["target/**", "**/target/**"]
  },
  {
    id: "flutter",
    label: "Dart / Flutter",
    signals: ["pubspec.yaml", "pubspec.lock"],
    include: [
      "pubspec.yaml",
      "pubspec.lock",
      "lib/**/*",
      "test/**/*",
      "assets/**/*",
      "**/*.dart"
    ],
    exclude: [
      "build/**",
      "**/build/**",
      ".dart_tool/**",
      "**/.dart_tool/**",
      ".flutter-plugins",
      ".flutter-plugins-dependencies"
    ]
  },
  {
    id: "swift",
    label: "Swift / iOS",
    signals: ["Package.swift", "*.xcodeproj", "*.xcworkspace", "Podfile"],
    include: [
      "Package.swift",
      "Package.resolved",
      "Podfile",
      "Podfile.lock",
      "Sources/**/*",
      "Tests/**/*",
      "**/*.swift"
    ],
    exclude: [
      ".build/**",
      "**/.build/**",
      "DerivedData/**",
      "**/DerivedData/**",
      "Pods/**",
      "**/Pods/**"
    ]
  },
  {
    id: "cpp",
    label: "C / C++",
    signals: ["CMakeLists.txt", "Makefile", "configure.ac", "meson.build"],
    include: [
      "CMakeLists.txt",
      "Makefile",
      "configure.ac",
      "meson.build",
      "src/**/*",
      "include/**/*",
      "tests/**/*",
      "test/**/*",
      "**/*.c",
      "**/*.cc",
      "**/*.cpp",
      "**/*.cxx",
      "**/*.h",
      "**/*.hpp"
    ],
    exclude: [
      "build/**",
      "**/build/**",
      "out/**",
      "**/out/**",
      "bin/**",
      "**/bin/**",
      "obj/**",
      "**/obj/**",
      "*.o",
      "*.obj"
    ]
  },
  {
    id: "nextjs",
    label: "Next.js",
    signals: ["next.config.js", "next.config.ts", "next.config.mjs", "next-env.d.ts"],
    include: [
      "next.config.*",
      "next-env.d.ts",
      "app/**/*",
      "pages/**/*",
      "components/**/*",
      "lib/**/*",
      "src/**/*",
      "public/**/*",
      "middleware.ts",
      "middleware.js",
      "tailwind.config.*",
      "postcss.config.*"
    ],
    exclude: [
      ".next/**",
      "**/.next/**",
      ".vercel/**",
      "**/.vercel/**",
      "out/**",
      "**/out/**"
    ]
  },
  {
    id: "django",
    label: "Django (Python)",
    signals: ["manage.py", "wsgi.py", "asgi.py"],
    include: [
      "manage.py",
      "wsgi.py",
      "asgi.py",
      "**/settings/*.py",
      "**/settings.py",
      "**/urls.py",
      "**/views.py",
      "**/models.py",
      "**/serializers.py",
      "**/admin.py",
      "**/forms.py",
      "**/migrations/**/*.py",
      "templates/**/*",
      "static/**/*",
      "apps/**/*"
    ],
    exclude: [
      "**/staticfiles/**",
      "**/media/**",
      "**/__pycache__/**"
    ]
  },
  {
    id: "fastapi",
    label: "FastAPI (Python)",
    signals: ["main.py", "app/main.py", "src/main.py"],
    include: [
      "main.py",
      "**/main.py",
      "**/routers/**/*.py",
      "**/schemas/**/*.py",
      "**/models/**/*.py",
      "**/services/**/*.py",
      "**/dependencies.py",
      "**/database.py",
      "alembic.ini",
      "alembic/**/*"
    ],
    exclude: ["**/__pycache__/**", "**/.pytest_cache/**", "**/.venv/**"]
  },
  {
    id: "rails",
    label: "Ruby on Rails",
    signals: ["config/application.rb", "config/routes.rb", "Gemfile"],
    include: [
      "Gemfile",
      "Gemfile.lock",
      "config/**/*",
      "app/**/*",
      "db/migrate/**/*",
      "db/seeds.rb",
      "db/schema.rb",
      "lib/**/*",
      "spec/**/*",
      "test/**/*"
    ],
    exclude: [
      "tmp/**",
      "log/**",
      "vendor/bundle/**",
      "public/assets/**",
      "public/packs/**",
      "node_modules/**"
    ]
  },
  {
    id: "flutter-mobile",
    label: "Flutter / Mobile App",
    signals: ["pubspec.yaml", "android/app/build.gradle", "ios/Runner.xcodeproj"],
    include: [
      "pubspec.yaml",
      "lib/**/*.dart",
      "test/**/*.dart",
      "android/app/build.gradle",
      "android/app/src/main/AndroidManifest.xml",
      "ios/Runner/Info.plist",
      "assets/**/*"
    ],
    exclude: [
      ".dart_tool/**",
      "build/**",
      "android/.gradle/**",
      "android/build/**",
      "ios/Pods/**",
      "ios/build/**",
      "ios/DerivedData/**"
    ]
  },
  {
    id: "rust-web",
    label: "Rust web service",
    signals: [
      "src/routes/**/*.rs",
      "src/handlers/**/*.rs",
      "src/api/**/*.rs",
      "src/server.rs"
    ],
    include: [
      "Cargo.toml",
      "Cargo.lock",
      "src/**/*.rs",
      "src/main.rs",
      "src/lib.rs",
      "src/routes/**/*.rs",
      "src/handlers/**/*.rs",
      "src/api/**/*.rs",
      "migrations/**/*.sql",
      "build.rs"
    ],
    exclude: ["target/**", "**/target/**"]
  }
];

export function detectTechnologyProfiles(
  files: string[],
  profiles: TechnologyProfile[] = DEFAULT_TECHNOLOGY_PROFILES
): TechnologyProfile[] {
  return profiles.filter((profile) => files.some((file) => matchesAnyGlob(file, profile.signals)));
}

export function buildIncludePatternsForProfiles(profiles: TechnologyProfile[]): string[] {
  const patterns = new Set<string>();
  for (const profile of profiles) {
    for (const pattern of profile.include) {
      patterns.add(pattern);
    }
  }
  return Array.from(patterns);
}

export function buildExcludePatternsForProfiles(profiles: TechnologyProfile[]): string[] {
  const patterns = new Set<string>();
  for (const profile of profiles) {
    for (const pattern of profile.exclude) {
      patterns.add(pattern);
    }
  }
  return Array.from(patterns);
}
