import { createRoot } from "react-dom/client";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { OperatorApp } from "@/components/operator/operator-app";
import { StageDock } from "@/components/operator/stage-dock";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ProjectionApp } from "@/components/projection/projection-app";
import { AppErrorComponent } from "@/lib/error-component";
import { AuthProvider } from "@/lib/auth/provider";
import { Instalar } from "@/routes/instalar";
import { Pedido } from "@/routes/pedido";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/500.css";
import "@/styles.css";

const root = createRootRoute({
  component: () => (
    <>
      <PreviewHostBridge />
      <AuthProvider>
        <Outlet />
        <Toaster theme="dark" position="bottom-right" richColors={false} />
      </AuthProvider>
    </>
  ),
});

const index = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: OperatorApp,
});

const projetor = createRoute({
  getParentRoute: () => root,
  path: "/projetor",
  component: () => <ProjectionApp variant="audience" />,
});

const palco = createRoute({
  getParentRoute: () => root,
  path: "/palco",
  component: () => (
    <div className="relative h-dvh w-dvw">
      <ProjectionApp variant="stage" />
      <StageDock />
    </div>
  ),
});

const pedido = createRoute({
  getParentRoute: () => root,
  path: "/pedido",
  component: Pedido,
});

const instalar = createRoute({
  getParentRoute: () => root,
  path: "/instalar",
  component: Instalar,
});

const router = createRouter({
  routeTree: root.addChildren([index, projetor, palco, pedido, instalar]),
  defaultErrorComponent: AppErrorComponent,
});

const el = document.getElementById("app");
if (!el) throw new Error("Lúmen: #app ausente");
createRoot(el).render(<RouterProvider router={router} />);
