import { Component, type ErrorInfo, type ReactNode } from "react";

type RootErrorBoundaryProps = {
  children: ReactNode;
};

type RootErrorBoundaryState = {
  hasError: boolean;
};

class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RootErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          className="flex min-h-screen items-center justify-center bg-slate-100 p-6"
          role="alert"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
            <h1 className="text-2xl font-semibold text-slate-900">
              Something went wrong
            </h1>
            <p className="mt-3 text-slate-600">
              An unexpected error occurred. Reload the page to try again.
            </p>
            <button
              className="mt-6 rounded-lg bg-indigo-700 px-5 py-3 font-medium text-white hover:bg-indigo-800"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload page
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default RootErrorBoundary;
