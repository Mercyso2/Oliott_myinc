import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "../components/theme-provider";
import { AppLayout } from "../components/app-layout";
import { AuthProvider } from "../lib/auth";
import { ProtectedRoute } from "../components/protected-route";
import { isSupabaseConfigured } from "../lib/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MYINC — Social Media com IA premium" },
      {
        name: "description",
        content:
          "Plataforma premium de social media com inteligência artificial. Planeje, crie e aprove conteúdo com qualidade de agência.",
      },
      { name: "author", content: "MYINC" },
      { property: "og:title", content: "MYINC — Social Media com IA premium" },
      {
        property: "og:description",
        content: "Automação criativa com qualidade de agência profissional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "MYINC — Social Media com IA premium" },
      {
        name: "description",
        content:
          "MYINC Creative Studio is an AI-powered platform for professional marketing content creation.",
      },
      {
        property: "og:description",
        content:
          "MYINC Creative Studio is an AI-powered platform for professional marketing content creation.",
      },
      {
        name: "twitter:description",
        content:
          "MYINC Creative Studio is an AI-powered platform for professional marketing content creation.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-6 text-sidebar-foreground">
      <div className="w-full max-w-2xl rounded-[2rem] border border-sidebar-border bg-sidebar-accent/70 p-8 shadow-elevated">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-sidebar-primary">MYINC V2 · Configuração obrigatória</p>
        <h1 className="mt-3 text-3xl font-bold">Supabase público não configurado</h1>
        <p className="mt-3 text-sm leading-relaxed text-sidebar-foreground/70">
          Para evitar tela branca e chamadas quebradas em produção, configure as variáveis públicas no Vercel antes de abrir o painel.
        </p>
        <pre className="mt-5 overflow-auto rounded-2xl bg-background/95 p-4 text-xs text-foreground">{`VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
VITE_APP_URL=https://seu-app.vercel.app
VITE_APP_ENV=production`}</pre>
        <p className="mt-4 text-xs text-sidebar-foreground/55">
          As chaves secretas ficam somente no Supabase Edge Secrets e no .env.engine local; nunca no frontend.
        </p>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const productionMissingSupabase = import.meta.env.VITE_APP_ENV === "production" && !isSupabaseConfigured;

  if (productionMissingSupabase) return <SetupRequired />;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ProtectedRoute>
            <AppLayout>
              <Outlet />
            </AppLayout>
          </ProtectedRoute>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
