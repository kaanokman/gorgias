import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import ReviewsTable from "@/components/Reviews";
import { Spinner } from "react-bootstrap";
import { validateRange } from "./helpers";

type Range = { start: string; end: string };

async function getReviews(range: Range) {
    const supabase = await createClient();

    const pageSize = 1000;
    const allRows: any[] = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from("reviews")
            .select(`id, domain, reviewText, reviewTitle, starRating, datePublished, reviewerName,
                companyReplied, sentiment, main_category, key_pain_point, actionable_insight`)
            .gte("datePublished", range.start.slice(0, 10))
            .lte("datePublished", range.end.slice(0, 10))
            .order("datePublished", { ascending: false })
            .range(from, from + pageSize - 1);

        if (error) {
            console.error("Error loading reviews: ", error.message);
            return { data: [], error: "Error loading reviews" };
        }

        const batch = data ?? [];
        allRows.push(...batch);

        if (batch.length < pageSize) break;
        from += pageSize;
    }

    return { data: allRows };
}

async function getAllDomains() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("reviews")
        .select("domain")
        .order("domain", { ascending: true });

    if (error) {
        console.error("Error loading review domains: ", error.message);
        return [] as string[];
    }

    return Array.from(
        new Set((data ?? []).map((row) => row.domain).filter((value): value is string => Boolean(value))),
    );
}

export default async function Dashboard({ searchParams }: { searchParams?: Promise<{ start?: string; end?: string }> }) {
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

async function ReviewsPage({ params }: { params?: Promise<{ start?: string; end?: string }> }) {
    const searchParams = await params;
    const { range, error } = validateRange(searchParams?.start, searchParams?.end);

    const start = range.start;
    const end = range.end;

    const [result, allDomains] = await Promise.all([
        error ? Promise.resolve({ data: [], error }) : getReviews({ start, end }),
        getAllDomains(),
    ]);

    return <ReviewsTable reviews={result.data} allDomains={allDomains} error={result.error} range={{ start, end }} />;
}
