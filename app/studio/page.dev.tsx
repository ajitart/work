"use client";

// The Studio: the editor running against this computer (dev only, see pageExtensions in next.config.ts).
// On the live site the same editor opens from the Edit button and publishes through GitHub.

import { Editor } from "@/components/editor/Editor";
import { localBackend } from "@/components/editor/local";

export default function Studio() {
  return <Editor backend={localBackend} publishLabel="Save" />;
}
