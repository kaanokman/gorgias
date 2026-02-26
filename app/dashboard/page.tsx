import { redirect } from "next/navigation";

export default async function DashboardRoot({
    searchParams: _searchParams,
}: {
    searchParams?: Promise<Record<string, string | undefined>>;
}) {
    void _searchParams;
    redirect("/dashboard/domains");
}
