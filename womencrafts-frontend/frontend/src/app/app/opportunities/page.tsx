import FindWorkPage from "./FindWorkPage";

/** A shared From-home link must apply the filter on the first data request. */
export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const requestedWhere = first(params.where);
  const where = requestedWhere === "Remote" || requestedWhere === "On-site" || requestedWhere === "Hybrid" ? requestedWhere : "";
  const requestedView = first(params.view);
  const view = requestedView === "all" || requestedView === "saved" ? requestedView : "mine";
  return <FindWorkPage key={`${where}:${view}`} initialWhere={where} initialView={view} />;
}
