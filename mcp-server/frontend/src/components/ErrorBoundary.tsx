import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-lg font-semibold">Bir şeyler ters gitti</h2>
          <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Tekrar dene
            </Button>
            <Button onClick={() => window.location.assign("/")}>Ana sayfa</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
