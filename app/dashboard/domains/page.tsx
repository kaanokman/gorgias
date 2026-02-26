import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateRange } from "../helpers";
import type { ReviewType } from "@/types/components";
import { Spinner, Table, Row, Col } from "react-bootstrap";
import { Suspense } from "react";
import { FaSortDown as Fa6SortDown, FaSortUp as Fa6SortUp } from "react-icons/fa6";
import DomainsDateRangeDropdown from "@/components/DomainsDateRangeDropdown";
import DomainReviewsRowButton from "@/components/DomainReviewsRowButton";
import DomainsMetricsTableClient from "@/components/DomainsMetricsTableClient";

type Range = { start: string; end: string };
type DomainMetricRow = {
    domain: string;
    numReviews: number;
    avgStarRating: number | null;
    negativePct: number;
    positivePct: number;
    topNegativeCategory: string | null;
};

type SortKey =
    | "domain"
    | "numReviews"
    | "avgStarRating"
    | "negativePct"
    | "positivePct"
    | "topNegativeCategory";

type SortDir = "asc" | "desc";
const defaultColumnMinWidth = 150;

function trustpilotReviewUrl(domain: string) {
    return `https://www.trustpilot.com/review/${encodeURIComponent(domain)}?languages=all`;
}

async function getReviewsForRange(range: Range) {
    const supabase = createAdminClient();

    const pageSize = 1000;
    const allRows: Pick<ReviewType, "id" | "domain" | "starRating" | "sentiment" | "main_category">[] = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from("reviews_bq")
            .select("id, domain, starRating, sentiment, main_category, datePublished")
            .gte("datePublished", range.start.slice(0, 10))
            .lte("datePublished", range.end.slice(0, 10))
            .order("datePublished", { ascending: false })
            .range(from, from + pageSize - 1);

        if (error) {
            console.error("Error loading domain metrics reviews:", error.message);
            return { data: [] as typeof allRows, error: "Error loading domain metrics" };
        }

        const batch = (data ?? []) as typeof allRows;
        allRows.push(...batch);

        if (batch.length < pageSize) break;
        from += pageSize;
    }

    return { data: allRows };
}

function formatLabel(value: string) {
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function percent(value: number) {
    return `${value.toFixed(1)}%`;
}

function buildDomainMetrics(
    reviews: Pick<ReviewType, "domain" | "starRating" | "sentiment" | "main_category">[],
): DomainMetricRow[] {
    const byDomain = new Map<string, {
        total: number;
        starSum: number;
        starCount: number;
        negative: number;
        positive: number;
        negativeCategoryCounts: Map<string, number>;
    }>();

    for (const review of reviews) {
        const domain = String(review.domain || "").trim();
        if (!domain) continue;

        const bucket = byDomain.get(domain) ?? {
            total: 0,
            starSum: 0,
            starCount: 0,
            negative: 0,
            positive: 0,
            negativeCategoryCounts: new Map<string, number>(),
        };

        bucket.total += 1;

        const star = Number(review.starRating);
        if (Number.isFinite(star) && star >= 1 && star <= 5) {
            bucket.starSum += star;
            bucket.starCount += 1;
        }

        const sentiment = String(review.sentiment || "").toLowerCase();
        if (sentiment === "negative") {
            bucket.negative += 1;
            const category = String(review.main_category || "uncategorized").trim() || "uncategorized";
            bucket.negativeCategoryCounts.set(category, (bucket.negativeCategoryCounts.get(category) ?? 0) + 1);
        } else if (sentiment === "positive") {
            bucket.positive += 1;
        }

        byDomain.set(domain, bucket);
    }

    return Array.from(byDomain.entries()).map(([domain, bucket]) => {
        let topNegativeCategory: string | null = null;
        let topNegativeCount = -1;

        for (const [category, count] of bucket.negativeCategoryCounts.entries()) {
            if (count > topNegativeCount || (count === topNegativeCount && category.localeCompare(topNegativeCategory ?? "") < 0)) {
                topNegativeCategory = category;
                topNegativeCount = count;
            }
        }

        return {
            domain,
            numReviews: bucket.total,
            avgStarRating: bucket.starCount > 0 ? bucket.starSum / bucket.starCount : null,
            negativePct: bucket.total > 0 ? (bucket.negative / bucket.total) * 100 : 0,
            positivePct: bucket.total > 0 ? (bucket.positive / bucket.total) * 100 : 0,
            topNegativeCategory: topNegativeCategory ? formatLabel(topNegativeCategory) : null,
        };
    });
}

function sortRows(rows: DomainMetricRow[], sort: SortKey, dir: SortDir) {
    const sorted = [...rows].sort((a, b) => {
        const direction = dir === "asc" ? 1 : -1;

        switch (sort) {
            case "domain":
                return a.domain.localeCompare(b.domain) * direction;
            case "topNegativeCategory":
                return (a.topNegativeCategory ?? "").localeCompare(b.topNegativeCategory ?? "") * direction;
            case "avgStarRating": {
                const aVal = a.avgStarRating ?? -1;
                const bVal = b.avgStarRating ?? -1;
                if (aVal === bVal) return a.domain.localeCompare(b.domain);
                return (aVal - bVal) * direction;
            }
            case "numReviews":
            case "negativePct":
            case "positivePct": {
                const aVal = a[sort];
                const bVal = b[sort];
                if (aVal === bVal) return a.domain.localeCompare(b.domain);
                return (aVal - bVal) * direction;
            }
            default:
                return 0;
        }
    });

    return sorted;
}

function SortHeader({
    label,
    sortKey,
    currentSort,
    currentDir,
    start,
    end,
    topNegativeCategory,
}: {
    label: string;
    sortKey: SortKey;
    currentSort: SortKey;
    currentDir: SortDir;
    start?: string;
    end?: string;
    topNegativeCategory?: string;
}) {
    const nextDir: SortDir = currentSort === sortKey && currentDir === "desc" ? "asc" : "desc";
    const isActive = currentSort === sortKey;

    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (topNegativeCategory) params.set("topNegativeCategory", topNegativeCategory);
    params.set("sort", sortKey);
    params.set("dir", nextDir);

    return (
        <Link href={`/dashboard/domains?${params.toString()}`} className="text-decoration-none text-reset d-block">
            <div className="d-flex align-items-center justify-content-between gap-2 text-nowrap">
                <span>{label}</span>
                <div
                    style={{ fontSize: "0.65rem", lineHeight: 1 }}
                    className="d-flex flex-column align-items-center"
                >
                    <Fa6SortUp
                        size={14}
                        style={{
                            color: isActive && currentDir === "asc" ? "#555" : "#adb5bd",
                            marginBottom: -7,
                        }}
                    />
                    <Fa6SortDown
                        size={14}
                        style={{
                            color: isActive && currentDir === "desc" ? "#555" : "#adb5bd",
                            marginTop: -7,
                        }}
                    />
                </div>
            </div>
        </Link>
    );
}

export default function DomainsPage({
    searchParams,
}: {
    searchParams?: Promise<{ start?: string; end?: string; sort?: string; dir?: string }>;
}) {
    return (
        <Suspense fallback={
            <div className="w-100 h-100 d-flex align-items-center justify-content-center">
                <Spinner />
            </div>
        }>
            <DomainsPageContent searchParams={searchParams} />
        </Suspense>
    );
}

async function DomainsPageContent({
    searchParams,
}: {
    searchParams?: Promise<{ start?: string; end?: string; sort?: string; dir?: string }>;
}) {
    const params = await searchParams;
    const { range, error } = validateRange(params?.start, params?.end);

    const sort = (["domain", "numReviews", "avgStarRating", "negativePct", "positivePct", "topNegativeCategory"]
        .includes(params?.sort ?? "")
        ? params?.sort
        : "numReviews") as SortKey;
    const dir = (params?.dir === "asc" || params?.dir === "desc" ? params.dir : "desc") as SortDir;

    const result = error ? { data: [] as Awaited<ReturnType<typeof getReviewsForRange>>["data"], error } : await getReviewsForRange(range);
    const rows = sortRows(buildDomainMetrics(result.data), sort, dir);

    return <DomainsMetricsTableClient rows={rows} range={range} sort={sort} dir={dir} startParam={params?.start} endParam={params?.end} />;
}
