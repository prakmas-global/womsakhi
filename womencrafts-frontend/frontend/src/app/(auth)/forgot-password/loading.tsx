import RouteLoading from "@/components/common/RouteLoading";

/** Shown while this route's code and data are on their way. The shape matches
 *  what the page renders, so the real content replaces it without a jump. */
export default function Loading() {
  return <RouteLoading shape="form" title={false} />;
}
