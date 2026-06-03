import { LoadingScreen } from "../LoadingScreen";

export default function TwinLoading() {
  return (
    <LoadingScreen
      lines={[
        "Waking your twin…",
        "Loading everything it knows about you…",
        "Scanning the network for your best match…",
        "Getting your home base ready…"
      ]}
    />
  );
}
