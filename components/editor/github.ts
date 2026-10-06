import type { ContentData, EditorBackend, SaveRequest, SaveResult } from "./backend";

export const REPO = { owner: "ajitart", name: "work", branch: "main" };
const API = "https://api.github.com";
const TOKEN_KEY = "ajit-work:github-token";

/** The token lives only in this browser's storage; it is never sent anywhere but api.github.com. */
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode: stays connected for this page only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class GitHubError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    // Never reuse a cached answer: a stale branch head makes the publish fail as "not a fast forward".
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { message?: string }).message ?? "";
    } catch {
      /* ignore */
    }
    if (res.status === 401) throw new GitHubError("GitHub didn't accept this token. It may have expired: create a new one in Settings.", 401);
    if (res.status === 403 || res.status === 404) {
      throw new GitHubError(
        `This token can't write to ${REPO.owner}/${REPO.name}. Give it access to that repository with Contents: Read and write. (${detail})`,
        res.status,
      );
    }
    throw new GitHubError(`GitHub returned an error (${res.status}): ${detail || res.statusText}`, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Check a token and return the GitHub username it belongs to. */
export async function verifyToken(token: string): Promise<string> {
  const user = await gh<{ login: string }>(token, "/user");
  await gh(token, `/repos/${REPO.owner}/${REPO.name}`);
  return user.login;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
    r.readAsDataURL(file);
  });
}

function utf8Base64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function githubBackend(token: string): EditorBackend {
  const repo = `/repos/${REPO.owner}/${REPO.name}`;

  const readJson = async <T,>(path: string): Promise<T> => {
    const file = await gh<{ content: string; encoding: string }>(token, `${repo}/contents/${path}?ref=${REPO.branch}`);
    const bin = atob(file.content.replace(/\n/g, ""));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  };

  return {
    label: `${REPO.owner}/${REPO.name}`,

    async load(): Promise<ContentData> {
      const [projects, making] = await Promise.all([
        readJson<ContentData["projects"]>("content/projects.json"),
        readJson<ContentData["making"]>("content/making.json"),
      ]);
      return { projects, making };
    },

    // One commit with every new file, every removal and both JSON files.
    async save(req: SaveRequest): Promise<SaveResult> {
      // Upload the files first (the slow part), then build the commit on the current branch head.
      const tree: { path: string; mode: "100644"; type: "blob"; sha: string | null }[] = [];
      for (const u of req.uploads) {
        const blob = await gh<{ sha: string }>(token, `${repo}/git/blobs`, {
          method: "POST",
          body: JSON.stringify({ content: await toBase64(u.file), encoding: "base64" }),
        });
        tree.push({ path: `public/${u.src}`, mode: "100644", type: "blob", sha: blob.sha });
      }
      const json = [
        { path: "content/projects.json", data: req.projects },
        { path: "content/making.json", data: req.making },
      ];
      for (const j of json) {
        const blob = await gh<{ sha: string }>(token, `${repo}/git/blobs`, {
          method: "POST",
          body: JSON.stringify({ content: utf8Base64(JSON.stringify(j.data, null, 2) + "\n"), encoding: "base64" }),
        });
        tree.push({ path: j.path, mode: "100644", type: "blob", sha: blob.sha });
      }
      for (const d of req.deletes) tree.push({ path: `public/${d}`, mode: "100644", type: "blob", sha: null });

      // If the branch moves while we're working (another publish, a deploy commit), rebuild on the new head and retry.
      for (let attempt = 0; ; attempt++) {
        const ref = await gh<{ object: { sha: string } }>(token, `${repo}/git/ref/heads/${REPO.branch}`);
        const parent = ref.object.sha;
        const parentCommit = await gh<{ tree: { sha: string } }>(token, `${repo}/git/commits/${parent}`);
        const newTree = await gh<{ sha: string }>(token, `${repo}/git/trees`, {
          method: "POST",
          body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree }),
        });
        const commit = await gh<{ sha: string }>(token, `${repo}/git/commits`, {
          method: "POST",
          body: JSON.stringify({ message: req.message, tree: newTree.sha, parents: [parent] }),
        });
        try {
          await gh(token, `${repo}/git/refs/heads/${REPO.branch}`, {
            method: "PATCH",
            body: JSON.stringify({ sha: commit.sha }),
          });
          return { note: "Published. The site updates in about a minute.", live: watchDeploy(token, commit.sha) };
        } catch (e) {
          if (!(e instanceof GitHubError) || e.status !== 422 || attempt >= 2) throw e;
        }
      }
    },

    // Fresh uploads aren't on the live site until the deploy finishes, so preview from the repository.
    mediaUrl(src: string) {
      return `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}/${REPO.branch}/public/${src}`;
    },
  };
}

/** Follow the deploy workflow for a commit. Resolves false if it fails or can't be followed. */
async function watchDeploy(token: string, sha: string): Promise<boolean> {
  const repo = `/repos/${REPO.owner}/${REPO.name}`;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 8000));
    try {
      const runs = await gh<{ workflow_runs: { status: string; conclusion: string | null }[] }>(
        token,
        `${repo}/actions/runs?head_sha=${sha}&per_page=1`,
      );
      const run = runs.workflow_runs[0];
      if (run?.status === "completed") return run.conclusion === "success";
    } catch {
      return false; // token without Actions access: we just can't tell
    }
  }
  return false;
}
