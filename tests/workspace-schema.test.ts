import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_IMAGE, workspaceSchema } from "../lib/workspace-schema";

describe("workspace creation schema", () => {
  it("defaults to the bundled image when no upload is provided", () => {
    expect(workspaceSchema.parse({ name: "My workspace", imageUrl: "" })).toEqual({
      name: "My workspace",
      imageUrl: DEFAULT_WORKSPACE_IMAGE,
    });
    expect(workspaceSchema.parse({ name: "My workspace" }).imageUrl).toBe(DEFAULT_WORKSPACE_IMAGE);
  });

  it("accepts a trusted uploaded image", () => {
    const imageUrl = "https://a1b2c3d4e5.ufs.sh/f/workspace.png";
    expect(workspaceSchema.parse({ name: "My workspace", imageUrl }).imageUrl).toBe(imageUrl);
  });

  it("rejects untrusted images and invalid workspace names", () => {
    expect(workspaceSchema.safeParse({ name: "My workspace", imageUrl: "https://evil.example/image.png" }).success).toBe(false);
    expect(workspaceSchema.safeParse({ name: " ", imageUrl: "" }).success).toBe(false);
  });
});
