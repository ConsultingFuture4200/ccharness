import { AlertCircle } from "lucide-react";
import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Catches render errors in a view so one broken tab shows a contained message
 * instead of unmounting the whole app to a blank page. A common trigger is
 * server/front-end version skew (a long-running `plugsmith serve` predating a
 * field the UI now expects) — the message hints at restarting the server.
 *
 * Wrapped inside each TabsContent, so switching tabs remounts and resets it.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>This view failed to render</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="font-mono text-xs">{this.state.error.message}</p>
            <p className="text-xs">
              If you recently updated plugsmith, restart the server — the running{" "}
              <span className="font-mono">plugsmith serve</span> may be an older version than this
              dashboard.
            </p>
          </AlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}
