import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON at ${filePath}: ${message}`);
  }
}

function validate() {
  const root = process.cwd();
  const packageJsonPath = path.join(root, "package.json");
  const lockfilePath = path.join(root, "package-lock.json");

  const pkg = readJson(packageJsonPath);
  const lock = readJson(lockfilePath);

  const pkgDeps = pkg.dependencies || {};
  const pkgDevDeps = pkg.devDependencies || {};
  const lockRoot = lock?.packages?.[""] || {};
  const lockDeps = lockRoot.dependencies || {};
  const lockDevDeps = lockRoot.devDependencies || {};
  const lockPackages = lock?.packages || {};

  const issues = [];

  for (const [name, expected] of Object.entries(pkgDeps)) {
    const locked = lockDeps[name];
    if (!locked) {
      issues.push(`- dependencies.${name}: missing from package-lock root dependencies`);
      continue;
    }
    if (locked !== expected) {
      issues.push(`- dependencies.${name}: package.json=${expected} package-lock=${locked}`);
    }

    if (!lockPackages[`node_modules/${name}`]) {
      issues.push(`- node_modules/${name}: missing package entry in package-lock`);
    }
  }

  for (const [name, expected] of Object.entries(pkgDevDeps)) {
    const locked = lockDevDeps[name];
    if (!locked) {
      issues.push(`- devDependencies.${name}: missing from package-lock root devDependencies`);
      continue;
    }
    if (locked !== expected) {
      issues.push(`- devDependencies.${name}: package.json=${expected} package-lock=${locked}`);
    }

    if (!lockPackages[`node_modules/${name}`]) {
      issues.push(`- node_modules/${name}: missing package entry in package-lock`);
    }
  }

  if (issues.length > 0) {
    console.error("[6PAC ERROR] package-lock.json is out of sync with package.json");
    for (const issue of issues) {
      console.error(issue);
    }
    console.error("[6PAC ERROR] Run `npm install` and commit package-lock.json before EAS build.");
    process.exit(1);
  }

  console.log("[6PAC CONFIG] package-lock.json is in sync with package.json");
}

validate();
