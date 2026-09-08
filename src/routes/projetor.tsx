import { createFileRoute } from "@tanstack/react-router";
import { ProjectionApp } from "@/components/projection/projection-app";

export const Route = createFileRoute("/projetor")({ component: Audience });

function Audience() {
  return <ProjectionApp variant="audience" />;
}
