// Tests for add-plugin-installer-script.js. The script is a stdin->stdout filter
// (no exported function), so we exercise it end-to-end as a subprocess, which is
// exactly how the build pipeline invokes it.

const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "add-plugin-installer-script.js");

// Run the script with `input` on stdin and return the parsed JSON written to stdout.
function run(input, args = []) {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], {
        input: typeof input === "string" ? input : JSON.stringify(input),
        encoding: "utf8",
    });
    assert.strictEqual(result.status, 0, `script exited non-zero: ${result.stderr}`);
    return JSON.parse(result.stdout);
}

test("adds an install script that invokes install-pulumi-plugin.js", () => {
    const out = run({
        name: "@pulumi/aws",
        version: "1.2.3",
        repository: "https://github.com/pulumi/pulumi-aws",
    });
    assert.strictEqual(
        out.scripts.install,
        "node scripts/install-pulumi-plugin.js resource aws " +
            "--server https://github.com/pulumi/pulumi-aws/releases/download/1.2.3 1.2.3",
    );
});

test("strips the scope from a scoped package name", () => {
    const out = run({
        name: "@pulumi/azure-native",
        version: "0.9.0",
        repository: "https://github.com/pulumi/pulumi-azure-native",
    });
    assert.match(out.scripts.install, /resource azure-native /);
});

test("uses an unscoped name verbatim", () => {
    const out = run({
        name: "mypkg",
        version: "2.0.0",
        repository: "https://github.com/example/mypkg",
    });
    assert.match(out.scripts.install, /resource mypkg /);
});

test("creates the scripts object when none exists", () => {
    const out = run({
        name: "@pulumi/gcp",
        version: "6.0.0",
        repository: "https://github.com/pulumi/pulumi-gcp",
    });
    assert.strictEqual(typeof out.scripts, "object");
    assert.ok(out.scripts.install);
});

test("preserves existing scripts and other fields", () => {
    const out = run({
        name: "@pulumi/gcp",
        version: "6.0.0",
        repository: "https://github.com/pulumi/pulumi-gcp",
        scripts: { build: "tsc" },
        dependencies: { "@pulumi/pulumi": "^3.0.0" },
    });
    assert.strictEqual(out.scripts.build, "tsc");
    assert.deepStrictEqual(out.dependencies, { "@pulumi/pulumi": "^3.0.0" });
    assert.ok(out.scripts.install);
});
