"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { projects } from "@/lib/content";
import { githubBackend, REPO, tokenStore, verifyToken } from "./github";
import { SETTINGS_EVENT } from "./events";
import styles from "./editmode.module.css";

// The editor itself only loads when you press Edit.
const Editor = dynamic(() => import("./Editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <p style={{ padding: 32, color: "var(--grey)" }}>Loading the editor…</p>,
});

const NEW_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

/**
 * Editing on the live site. Visitors see nothing. After connecting GitHub once
 * in Settings, an Edit button appears on every page for this browser only.
 */
export function EditMode() {
  const [token, setToken] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setToken(tokenStore.get());
    const open = () => setSettingsOpen(true);
    window.addEventListener(SETTINGS_EVENT, open);
    return () => window.removeEventListener(SETTINGS_EVENT, open);
  }, []);

  // While the editor is open: normal cursor, no page scroll.
  useEffect(() => {
    const root = document.documentElement;
    if (editorOpen) {
      root.dataset.editing = "";
      root.classList.add("is-locked");
    } else {
      delete root.dataset.editing;
      if (!root.dataset.intro) root.classList.remove("is-locked");
    }
  }, [editorOpen]);

  const slug = pathname.split("/").filter(Boolean)[0];
  const initial = useMemo(
    () => ({ tab: "projects" as const, key: projects.some((p) => p.slug === slug) ? slug : undefined }),
    [slug],
  );
  const backend = useMemo(() => (token ? githubBackend(token) : null), [token]);

  return (
    <>
      {token && !editorOpen && (
        <button type="button" className={styles.editButton} onClick={() => setEditorOpen(true)}>
          Edit
        </button>
      )}
      {settingsOpen && (
        <Settings
          connected={!!token}
          onClose={() => setSettingsOpen(false)}
          onConnect={(t) => {
            tokenStore.set(t);
            setToken(t);
          }}
          onDisconnect={() => {
            tokenStore.clear();
            setToken(null);
            setEditorOpen(false);
          }}
        />
      )}
      {editorOpen && backend && (
        <div className={styles.editor} role="dialog" aria-modal="true" aria-label="Edit portfolio">
          <Editor backend={backend} initial={initial} onClose={() => setEditorOpen(false)} />
        </div>
      )}
    </>
  );
}

function Settings({
  connected,
  onClose,
  onConnect,
  onDisconnect,
}: {
  connected: boolean;
  onClose: () => void;
  onConnect: (token: string) => void;
  onDisconnect: () => void;
}) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<{ busy?: boolean; error?: string; user?: string }>({});
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.editing = "";
    input.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      if (!document.querySelector(`.${styles.editor}`)) delete document.documentElement.dataset.editing;
    };
  }, [onClose]);

  useEffect(() => {
    const t = tokenStore.get();
    if (connected && t) verifyToken(t).then((user) => setState({ user }), (e: Error) => setState({ error: e.message }));
  }, [connected]);

  const connect = useCallback(async () => {
    const t = value.trim();
    if (!t) return;
    setState({ busy: true });
    try {
      const user = await verifyToken(t);
      onConnect(t);
      setValue("");
      setState({ user });
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  }, [value, onConnect]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.settings} role="dialog" aria-modal="true" aria-labelledby="settings-h" onClick={(e) => e.stopPropagation()}>
        <div className={styles.settingsHead}>
          <h2 id="settings-h">Settings</h2>
          <button type="button" className={styles.x} onClick={onClose} aria-label="Close settings">
            Close
          </button>
        </div>

        {connected ? (
          <>
            <p>
              Editing is on for this browser{state.user ? `, connected to GitHub as ${state.user}` : ""}. Use the <strong>Edit</strong> button at the
              bottom right of any page to add or delete images and videos.
            </p>
            {state.error && <p className={styles.error}>{state.error}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={onClose}>
                Done
              </button>
              <button type="button" className={styles.secondary} onClick={onDisconnect}>
                Turn off editing on this browser
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Connect GitHub once to add and delete images and videos from this site. Visitors never see the editing controls.</p>
            <ol className={styles.steps}>
              <li>
                Open{" "}
                <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer">
                  GitHub → New fine-grained token
                </a>{" "}
                and sign in.
              </li>
              <li>
                Name it “Portfolio editor”. Under <em>Repository access</em> choose <em>Only select repositories</em> →{" "}
                <code>
                  {REPO.owner}/{REPO.name}
                </code>
                .
              </li>
              <li>
                Under <em>Permissions</em> set <em>Contents</em> to <em>Read and write</em> (and <em>Actions</em> to <em>Read-only</em> to see when changes are
                live).
              </li>
              <li>Generate the token, copy it, and paste it below.</li>
            </ol>
            <label className={styles.field}>
              <span>GitHub token</span>
              <input
                ref={input}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={value}
                placeholder="github_pat_…"
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && connect()}
              />
            </label>
            {state.error && <p className={styles.error}>{state.error}</p>}
            <p className={styles.note}>The token is kept only in this browser and is used only to talk to GitHub.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={connect} disabled={!value.trim() || state.busy}>
                {state.busy ? "Checking…" : "Connect"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
