import { createFileRoute } from "@tanstack/react-router";
import { StageDock } from "@/components/operator/stage-dock";
import { ProjectionApp } from "@/components/projection/projection-app";

export const Route = createFileRoute("/palco")({ component: Stage });

function Stage() {
  return (
    <div className="relative h-dvh w-dvw">
      <ProjectionApp variant="stage" />
      <StageDock />
    </div>
  );
}
