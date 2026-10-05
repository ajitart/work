import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { featuredProjects, getProject, projects } from "@/lib/content";
import { ProjectView } from "@/components/project/ProjectView";

export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) return {};
  return { title: p.title, description: p.statement || p.subtitle };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  // "Next" walks the selected work in order; archive entries lead back into it.
  const i = featuredProjects.findIndex((p) => p.slug === slug);
  const next = featuredProjects[(i + 1) % featuredProjects.length];

  return <ProjectView project={project} next={next} />;
}
