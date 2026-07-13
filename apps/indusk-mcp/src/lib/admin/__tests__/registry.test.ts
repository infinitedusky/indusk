import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addProject,
  readRegistry,
  touchProject,
  validateProject,
} from "../registry.js";

/**
 * T8 — `indusk init` adds a project to the registry. (Tested at the registry-
 *      function level; the CLI integration test covers `indusk init` itself.)
 * T9 — `indusk update` validates without duplicating; lastSeenAt moves forward.
 * T10 — basename collision gets a numeric suffix.
 *
 * Tests use the INDUSK_HOME env var (added in Phase 2 alongside this file)
 * to redirect the registry away from the user's real ~/.indusk/.
 */

let testHome: string;

describe("registry", () => {
  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), "indusk-home-"));
    mkdirSync(testHome, { recursive: true });
    process.env.INDUSK_HOME = testHome;
  });

  afterEach(() => {
    delete process.env.INDUSK_HOME;
    if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
  });

describe("empty state", () => {
  it("readRegistry returns empty projects array when file absent", () => {
    const reg = readRegistry();
    expect(reg.projects).toEqual([]);
    expect(reg.version).toBe(1);
  });
});

describe("T8 — addProject appends a new project entry", () => {
  it("returns the entry it created and persists it to disk", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "alpha-"));
    try {
      const entry = addProject(projectDir);
      expect(entry.path).toBe(projectDir);
      expect(entry.name).toBe(projectDir.split("/").pop());
      expect(entry.registeredAt).toBeDefined();
      expect(entry.lastSeenAt).toBeDefined();

      const reg = readRegistry();
      expect(reg.projects).toHaveLength(1);
      expect(reg.projects[0].path).toBe(projectDir);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe("T9 — validateProject + touchProject", () => {
  it("validateProject reports pathExists=true for an existing registered project", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "beta-"));
    try {
      const entry = addProject(projectDir);
      const result = validateProject(entry.name);
      expect(result.entry.path).toBe(projectDir);
      expect(result.pathExists).toBe(true);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it("validateProject reports pathExists=false when path was deleted", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "gamma-"));
    const entry = addProject(projectDir);
    rmSync(projectDir, { recursive: true, force: true });
    const result = validateProject(entry.name);
    expect(result.entry.path).toBe(projectDir);
    expect(result.pathExists).toBe(false);
  });

  it("touchProject moves lastSeenAt forward without creating a duplicate", async () => {
    const projectDir = mkdtempSync(join(tmpdir(), "delta-"));
    try {
      const initial = addProject(projectDir);
      const initialSeen = initial.lastSeenAt;
      // Wait a millisecond so the new ISO timestamp is strictly greater
      await new Promise((r) => setTimeout(r, 5));
      touchProject(initial.name);
      const reg = readRegistry();
      expect(reg.projects).toHaveLength(1); // not duplicated
      expect(new Date(reg.projects[0].lastSeenAt).getTime()).toBeGreaterThan(
        new Date(initialSeen).getTime(),
      );
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe("T10 — basename collision gets a numeric suffix", () => {
  it("second project with same basename registers as 'name-2'", () => {
    const dirA = mkdtempSync(join(tmpdir(), "wrap1-"));
    const dirB = mkdtempSync(join(tmpdir(), "wrap2-"));
    const sharedBase = "myproj";
    const aProject = join(dirA, sharedBase);
    const bProject = join(dirB, sharedBase);
    mkdirSync(aProject);
    mkdirSync(bProject);
    try {
      const first = addProject(aProject);
      const second = addProject(bProject);
      expect(first.name).toBe(sharedBase);
      expect(second.name).toBe(`${sharedBase}-2`);

      const reg = readRegistry();
      expect(reg.projects.map((p) => p.name)).toEqual([sharedBase, `${sharedBase}-2`]);
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  it("third project with same basename gets '-3' (suffix increments)", () => {
    const dirs = ["wrap1-", "wrap2-", "wrap3-"].map((p) =>
      mkdtempSync(join(tmpdir(), p)),
    );
    const base = "tribase";
    const projects = dirs.map((d) => {
      const p = join(d, base);
      mkdirSync(p);
      return p;
    });
    try {
      const entries = projects.map((p) => addProject(p));
      expect(entries.map((e) => e.name)).toEqual([base, `${base}-2`, `${base}-3`]);
    } finally {
      for (const d of dirs) rmSync(d, { recursive: true, force: true });
    }
  });
});

}); // end registry wrapper describe
