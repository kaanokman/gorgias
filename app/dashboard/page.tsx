import { createAdminClient } from "@/lib/supabase/admin";
import { Suspense } from "react";
import ReviewsTable from "@/components/Reviews";
import { Spinner } from "react-bootstrap";
import { validateRange } from "./helpers";
import type { ReviewType } from "@/types/components";

type Range = { start: string; end: string };

async function getReviews(range: Range, domain?: string) {
    const supabase = createAdminClient();

    const pageSize = 1000;
    const allRows: ReviewType[] = [];
    let from = 0;

    while (true) {
        let query = supabase
            .from("reviews_bq")
            .select(`id, domain, reviewText, reviewTitle, starRating, datePublished, reviewerName,
                companyReplied, sentiment, main_category, key_pain_point, actionable_insight`)
            .gte("datePublished", range.start.slice(0, 10))
            .lte("datePublished", range.end.slice(0, 10));

        if (domain) {
            query = query.eq("domain", domain);
        }

        const { data, error } = await query
            .order("datePublished", { ascending: false })
            .range(from, from + pageSize - 1);

        if (error) {
            console.error("Error loading reviews: ", error.message);
            return { data: [], error: "Error loading reviews" };
        }

        const batch = (data ?? []) as ReviewType[];
        allRows.push(...batch);

        if (batch.length < pageSize) break;
        from += pageSize;
    }

    return { data: allRows };
}

async function getAllDomains() {
    const supabase = createAdminClient();

    // Prefer a DB-side DISTINCT function/view to avoid client-side row caps.
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_review_domains");

    if (!rpcError) {
        const rpcRows = (rpcData ?? []) as Array<{ domain: string | null }>;
        return Array.from(
            new Set(rpcRows.map((row) => row.domain).filter((value): value is string => Boolean(value))),
        ).sort((a, b) => a.localeCompare(b));
    }

    console.warn("Falling back to paginated domain fetch; RPC get_review_domains unavailable:", rpcError.message);

    const pageSize = 1000;
    const allRows: Array<{ domain: string | null }> = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from("reviews_bq")
            .select("domain")
            .order("domain", { ascending: true })
            .range(from, from + pageSize - 1);

        if (error) {
            console.error("Error loading review domains: ", error.message);
            return [] as string[];
        }

        const batch = (data ?? []) as Array<{ domain: string | null }>;
        allRows.push(...batch);

        if (batch.length < pageSize) break;
        from += pageSize;
    }

    return Array.from(
        new Set(allRows.map((row) => row.domain).filter((value): value is string => Boolean(value))),
    ).sort((a, b) => a.localeCompare(b));
}

export default async function Dashboard({
    searchParams,
}: {
    searchParams?: Promise<{ start?: string; end?: string; domain?: string }>;
}) {
    return (
        <Suspense fallback={
            <div className='w-100 h-100 flex items-center justify-center'>
                <Spinner />
            </div>
        }>
            <ReviewsPage params={searchParams} />
        </Suspense>
    );
}

async function ReviewsPage({ params }: { params?: Promise<{ start?: string; end?: string; domain?: string }> }) {
    const searchParams = await params;
    const { range, error } = validateRange(searchParams?.start, searchParams?.end);

    const start = range.start;
    const end = range.end;

    const allDomains = await getAllDomains();
    const selectedDomain = allDomains.includes(searchParams?.domain ?? "")
        ? (searchParams?.domain as string)
        : (allDomains[0] ?? "");

    const result = error
        ? { data: [], error }
        : await getReviews({ start, end }, selectedDomain || undefined);

    return (
        <ReviewsTable
            reviews={result.data}
            allDomains={allDomains}
            selectedDomain={selectedDomain}
            error={result.error}
            range={{ start, end }}
        />
    );
}
