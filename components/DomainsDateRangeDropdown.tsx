"use client";

import Link from "next/link";
import { Dropdown } from "react-bootstrap";

type SortKey =
    | "domain"
    | "numReviews"
    | "avgStarRating"
    | "negativePct"
    | "positivePct"
    | "topNegativeCategory";

type SortDir = "asc" | "desc";
type DateRangeOption = { label: string; days?: number; months?: number; years?: number };

const dateRangeOptions: DateRangeOption[] = [
    { label: "Last 30 Days", days: 30 },
    { label: "Last 3 Months", months: 3 },
    { label: "Last 6 Months", months: 6 },
    { label: "Last Year", years: 1 },
    { label: "Last 2 Years", years: 2 },
    { label: "Last 3 Years", years: 3 },
    { label: "Last 5 Years", years: 5 },
    { label: "Last 10 Years", years: 10 },
];

function formatRangeLabel(startIso: string, endIso: string) {
    const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "2-digit", year: "numeric" };
    return `${new Date(startIso).toLocaleDateString("en-US", fmt)} - ${new Date(endIso).toLocaleDateString("en-US", fmt)}`;
}

function buildRangeHref({
    start,
    end,
    sort,
    dir,
    topNegativeCategory,
}: {
    start: string;
    end: string;
    sort: SortKey;
    dir: SortDir;
    topNegativeCategory?: string;
}) {
    const params = new URLSearchParams();
    params.set("start", start);
    params.set("end", end);
    params.set("sort", sort);
    params.set("dir", dir);
    if (topNegativeCategory) {
        params.set("topNegativeCategory", topNegativeCategory);
    }
    return `/dashboard/domains?${params.toString()}`;
}

export default function DomainsDateRangeDropdown({
    start,
    end,
    sort,
    dir,
    topNegativeCategory,
}: {
    start: string;
    end: string;
    sort: SortKey;
    dir: SortDir;
    topNegativeCategory?: string;
}) {
    const now = new Date();

    return (
        <Dropdown>
            <Dropdown.Toggle variant="outline-bark" className="w-100 text-start rounded-1">
                {formatRangeLabel(start, end)}
            </Dropdown.Toggle>
            <Dropdown.Menu>
                {dateRangeOptions.map(({ label, days, months, years }) => {
                    const nextEnd = new Date(now);
                    const nextStart = new Date(now);

                    if (days) nextStart.setDate(nextEnd.getDate() - days);
                    if (months) nextStart.setMonth(nextEnd.getMonth() - months);
                    if (years) nextStart.setFullYear(nextEnd.getFullYear() - years);

                    const href = buildRangeHref({
                        start: nextStart.toISOString().slice(0, 10),
                        end: nextEnd.toISOString().slice(0, 10),
                        sort,
                        dir,
                        topNegativeCategory,
                    });

                    return (
                        <Dropdown.Item as={Link} href={href} key={label}>
                            {label}
                        </Dropdown.Item>
                    );
                })}
            </Dropdown.Menu>
        </Dropdown>
    );
}
