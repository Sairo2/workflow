import { AppProviders } from "./providers";
import { AppRouter } from "./router";
import "../shared/styles/global.css";

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
