import { asset, site } from "@/lib/content";
import styles from "./about.module.css";

export function About() {
  const { statement, facts, photo } = site.about;
  return (
    <section id="about" className={styles.about} aria-labelledby="about-h">
      <div className={styles.top}>
        <p className="meta" id="about-h">
          About
        </p>
      </div>
      <div className={styles.body}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.photo} src={asset(photo)} alt="Ajit Shitole" loading="lazy" decoding="async" />
        <div>
          <p className={styles.statement}>{statement}</p>
          <dl className={styles.facts}>
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
