import { createBrowserRouter, Navigate, RouterProvider, useParams } from "react-router"
import { AppLayout } from "@/components/app-layout"
import { FeatureRoute, HomeRoute } from "@/components/feature-routes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { POLICE_FILES_BASE } from "@/features/case-files/paths"
import { features } from "@/features/registry"

// Old links used hash routing (`/#/fsu/...`); move them to the real path.
if (location.hash.startsWith("#/")) {
  history.replaceState(null, "", location.hash.slice(1))
}

// The desktop shell serves index.html for unknown paths (electron/main.cjs).
const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRoute /> },
      ...features.map((f) => ({
        path: `${f.path}/*`,
        element: <FeatureRoute path={f.path}>{f.element}</FeatureRoute>,
      })),
      // The analyses used to be a tab of their own; they are Akten now, under the same id.
      { path: "forensics/*", element: <ForensicsRedirect /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster />
    </TooltipProvider>
  )
}

function ForensicsRedirect() {
  const rest = useParams()["*"]
  return <Navigate to={rest ? `${POLICE_FILES_BASE}/${rest}` : POLICE_FILES_BASE} replace />
}
