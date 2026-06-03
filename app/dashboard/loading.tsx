import { LoadingScreen } from "../LoadingScreen";

export default function DashboardLoading() {
  return (
    <LoadingScreen
      lines={[
        "Reading the network…",
        "Prioritizing your inbox…",
        "Scoring today's opportunities…",
        "Opening doors…"
      ]}
    />
  );
}
