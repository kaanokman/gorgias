'use client';

import { useCallback, useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Row,
    Col,
    Dropdown,
    Form,
    Modal,
    Button,
    Pagination,
    Table,
    OverlayTrigger,
    Tooltip,
    Tabs,
    Tab,
    Spinner,
} from "react-bootstrap";
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type ColumnDef,
    type PaginationState,
    type SortingState,
    useReactTable,
} from "@tanstack/react-table";
import { toast } from "react-toastify";
import { FaRegStar } from "react-icons/fa";
import { FaSortDown as Fa6SortDown, FaSortUp as Fa6SortUp } from "react-icons/fa6";
import { CgFileDocument } from "react-icons/cg";
import { ReviewType } from "@/types/components";
import Select, { type StylesConfig } from "react-select";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";

type RangeISO = { start: string; end: string };
type FilterOption = { value: string; label: string };

const toastSettings = {
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
};

function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    }).format(new Date(date));
}

function truncate(value: string | null | undefined, max = 140) {
    if (!value) return null;
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
}

function formatLabel(value: string) {
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

const tableTextStyle: CSSProperties = {
    fontSize: "0.92rem",
    lineHeight: 1.35,
};

const defaultColumnMinWidth = 135;
const actionColumnWidth = 92;
const starIconColor = "#f7c96b";
const chartColors = {
    primary: "#0d6efd",
    success: "#198754",
    danger: "#dc3545",
};

const scrollableCellColumns = new Set(["reviewTitle", "reviewText"]);

function Stars({ value }: { value: number }) {
    return (
        <div className="d-flex align-items-center gap-1">
            <FaRegStar color={starIconColor} />
            {value}
        </div>
    );
}

function ChartNoData() {
    return (
        <div className="d-flex align-items-center justify-content-center text-muted text-center" style={{ height: 229 }}>
            No data in selected time range
        </div>
    );
}

function ReviewDetailsActions({ review }: { review: ReviewType }) {
    const [show, setShow] = useState(false);
    const hasDetails = Boolean(review.key_pain_point || review.actionable_insight);
    const tooltipLabel = hasDetails ? "View insights" : "No insights available";

    return (
        <>
            <div className="d-flex gap-1">
                <OverlayTrigger trigger={["hover", "focus"]} overlay={<Tooltip>{tooltipLabel}</Tooltip>}>
                    <span className="d-inline-flex">
                        <Button
                            variant="outline-bark"
                            onClick={() => hasDetails && setShow(true)}
                            style={{ height: 36, width: 36 }}
                            className="p-0 d-flex justify-content-center align-items-center"
                            disabled={!hasDetails}
                        >
                            <CgFileDocument size={20} style={{ marginLeft: "2px" }} />
                        </Button>
                    </span>
                </OverlayTrigger>
            </div>

            <Modal show={show} onHide={() => setShow(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Insights</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-flex flex-column gap-3 p-4 pt-3">
                    <div>
                        <div className="fw-bold mb-1">Key Pain Point</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>
                            {review.key_pain_point || <span className="text-muted">None</span>}
                        </div>
                    </div>
                    <div>
                        <div className="fw-bold mb-1">Actionable Insight</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>
                            {review.actionable_insight || <span className="text-muted">None</span>}
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        </>
    );
}

export default function ReviewsTable({
    reviews,
    allDomains,
    selectedDomain,
    error,
    range,
}: {
    reviews: ReviewType[];
    allDomains: string[];
    selectedDomain?: string;
    error?: string;
    range: RangeISO;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [sorting, setSorting] = useState<SortingState>([{ id: "datePublished", desc: true }]);
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 5 });
    const [showRangeModal, setShowRangeModal] = useState(false);
    const [activeTab, setActiveTab] = useState<"table" | "metrics">("metrics");
    const [dateRange, setDateRange] = useState(() => ({
        start: new Date(range.start),
        end: new Date(range.end),
    }));

    const [domain, setDomain] = useState(selectedDomain ?? "");
    const [pendingDomain, setPendingDomain] = useState<string | null>(null);
    const [sentiment, setSentiment] = useState("");
    const [category, setCategory] = useState("");
    const [replyFilter, setReplyFilter] = useState<"" | "replied" | "not_replied">("");
    const [starFilter, setStarFilter] = useState<"" | "1" | "2" | "3" | "4" | "5">("");

    useEffect(() => {
        setDateRange({ start: new Date(range.start), end: new Date(range.end) });
    }, [range.start, range.end]);

    useEffect(() => {
        const nextTab = searchParams.get("tab");
        setActiveTab(nextTab === "table" || nextTab === "metrics" ? nextTab : "metrics");
    }, [searchParams]);

    useEffect(() => {
        setDomain(selectedDomain ?? "");
        setPendingDomain(null);
    }, [selectedDomain]);

    useEffect(() => {
        if (error) {
            toast.error(error, { ...toastSettings, toastId: "reviewsError" });
        }
    }, [error]);

    useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [domain, sentiment, category, replyFilter, starFilter, reviews.length]);

    const dateRangeOptions = useMemo(() => [
        { label: "Last 30 Days", days: 30 },
        { label: "Last 3 Months", months: 3 },
        { label: "Last 6 Months", months: 6 },
        { label: "Last Year", years: 1 },
        { label: "Last 2 Years", years: 2 },
        { label: "Last 3 Years", years: 3 },
        { label: "Last 5 Years", years: 5 },
        { label: "Last 10 Years", years: 10 },
    ], []);

    const domains = useMemo(
        () => Array.from(new Set(allDomains.filter(Boolean))).sort(),
        [allDomains],
    );
    const sentiments = useMemo(
        () => Array.from(new Set(reviews.map((r) => r.sentiment).filter(Boolean))).sort(),
        [reviews],
    );
    const categories = useMemo(() => {
        const counts = new Map<string, number>();

        for (const review of reviews) {
            const key = review.main_category;
            if (!key) continue;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }

        return Array.from(counts.keys()).sort((a, b) => {
            const aIsOther = a.trim().toLowerCase() === "other";
            const bIsOther = b.trim().toLowerCase() === "other";
            if (aIsOther !== bIsOther) return aIsOther ? 1 : -1;

            const countDiff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
            if (countDiff !== 0) return countDiff;

            return a.localeCompare(b);
        });
    }, [reviews]);
    const starOptions = useMemo(
        () => ["5", "4", "3", "2", "1"].map((value) => ({ value, label: value })),
        [],
    );
    const replyOptions = useMemo(
        () => [
            { value: "replied", label: "Yes" },
            { value: "not_replied", label: "No" },
        ],
        [],
    );
    const domainOptions = useMemo<FilterOption[]>(
        () => domains.map((value) => ({ value, label: value })),
        [domains],
    );
    const sentimentOptions = useMemo<FilterOption[]>(
        () => {
            const sentimentOrder: Record<string, number> = {
                positive: 0,
                neutral: 1,
                negative: 2,
            };

            return [...sentiments]
                .sort((a, b) => {
                    const aRank = sentimentOrder[a] ?? 999;
                    const bRank = sentimentOrder[b] ?? 999;
                    if (aRank !== bRank) return aRank - bRank;
                    return a.localeCompare(b);
                })
                .map((value) => ({ value, label: formatLabel(value) }));
        },
        [sentiments],
    );
    const categoryOptions = useMemo<FilterOption[]>(
        () => categories.map((value) => ({ value, label: formatLabel(value) })),
        [categories],
    );
    const filterSelectStyles = useMemo<StylesConfig<FilterOption, false>>(() => ({
        control: (base, state) => ({
            ...base,
            minHeight: 38,
            borderColor: state.isFocused ? "#ff9780" : base.borderColor,
            boxShadow: state.isFocused ? "0 0 0 1px #ff9780" : base.boxShadow,
            "&:hover": {
                borderColor: "#ff9780",
            },
        }),
        menu: (base) => ({ ...base, zIndex: 5 }),
    }), []);

    useEffect(() => {
        if (domains.length === 0) {
            if (domain !== "") setDomain("");
            return;
        }

        if (!domain || !domains.includes(domain)) {
            setDomain(domains[0]);
        }
    }, [domains, domain]);

    const onDateRangeChange = useCallback((nextRange: { start: Date; end: Date }) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("start", nextRange.start.toISOString().slice(0, 10));
        params.set("end", nextRange.end.toISOString().slice(0, 10));
        params.set("tab", activeTab);
        startTransition(() => {
            router.replace(`?${params.toString()}`);
            router.refresh();
        });
    }, [activeTab, router, searchParams, startTransition]);

    const onDomainChange = useCallback((nextDomain: string) => {
        setPendingDomain(nextDomain);
        const params = new URLSearchParams(searchParams.toString());
        params.set("domain", nextDomain);
        params.set("tab", activeTab);
        startTransition(() => {
            router.replace(`?${params.toString()}`);
            router.refresh();
        });
    }, [activeTab, router, searchParams, startTransition]);

    const onTabChange = useCallback((nextTab: "table" | "metrics") => {
        setActiveTab(nextTab);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", nextTab);
        router.replace(`?${params.toString()}`);
    }, [router, searchParams]);

    const filteredReviews = useMemo(() => {
        return reviews.filter((review) => {
            if (domain && review.domain !== domain) return false;
            if (sentiment && review.sentiment !== sentiment) return false;
            if (category && review.main_category !== category) return false;
            if (replyFilter === "replied" && !review.companyReplied) return false;
            if (replyFilter === "not_replied" && review.companyReplied) return false;
            if (starFilter && String(review.starRating) !== starFilter) return false;
            return true;
        });
    }, [reviews, domain, sentiment, category, replyFilter, starFilter]);

    const domainReviews = useMemo(() => {
        if (!domain) return [];
        return reviews.filter((review) => review.domain === domain);
    }, [reviews, domain]);

    const categorySentimentDistribution = useMemo(() => {
        const byCategory = new Map<string, { negative: number; neutral: number; positive: number }>();

        for (const review of domainReviews) {
            const categoryKey = formatLabel(review.main_category || "uncategorized");
            const sentimentKey = String(review.sentiment || "").toLowerCase();
            const bucket = byCategory.get(categoryKey) ?? { negative: 0, neutral: 0, positive: 0 };

            if (sentimentKey === "negative") bucket.negative += 1;
            else if (sentimentKey === "neutral") bucket.neutral += 1;
            else if (sentimentKey === "positive") bucket.positive += 1;

            byCategory.set(categoryKey, bucket);
        }

        return Array.from(byCategory.entries())
            .map(([label, counts]) => ({
                label,
                ...counts,
                total: counts.negative + counts.neutral + counts.positive,
            }))
            .sort((a, b) => b.total - a.total);
    }, [domainReviews]);

    const overallSentimentCounts = useMemo(() => {
        const counts = { negative: 0, neutral: 0, positive: 0 };
        for (const review of domainReviews) {
            const sentimentKey = String(review.sentiment || "").toLowerCase();
            if (sentimentKey === "negative") counts.negative += 1;
            else if (sentimentKey === "neutral") counts.neutral += 1;
            else if (sentimentKey === "positive") counts.positive += 1;
        }
        return counts;
    }, [domainReviews]);

    const sentimentTotal = useMemo(
        () =>
            overallSentimentCounts.negative +
            overallSentimentCounts.neutral +
            overallSentimentCounts.positive,
        [overallSentimentCounts],
    );

    const sentimentPieData = useMemo(() => {
        if (sentimentTotal === 0) return [];
        return [
            { id: "positive", value: overallSentimentCounts.positive, label: "Positive", color: chartColors.success },
            { id: "neutral", value: overallSentimentCounts.neutral, label: "Neutral", color: chartColors.primary },
            { id: "negative", value: overallSentimentCounts.negative, label: "Negative", color: chartColors.danger },
        ].filter((item) => item.value > 0);
    }, [overallSentimentCounts, sentimentTotal]);

    const starRatingMetrics = useMemo(() => {
        const values = domainReviews
            .map((r) => Number(r.starRating))
            .filter((v) => Number.isFinite(v) && v >= 1 && v <= 5)
            .sort((a, b) => a - b);

        const counts = [1, 2, 3, 4, 5].map((star) => ({
            star,
            count: values.filter((v) => v === star).length,
        }));

        if (values.length === 0) {
            return {
                counts,
                mean: null as number | null,
                median: null as number | null,
            };
        }

        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const mid = Math.floor(values.length / 2);
        const median =
            values.length % 2 === 0
                ? (values[mid - 1] + values[mid]) / 2
                : values[mid];

        return { counts, mean, median };
    }, [domainReviews]);

    const totalDomainReviews = domainReviews.length;

    const columnDefs = useMemo<ColumnDef<ReviewType>[]>(() => [
        {
            accessorKey: "reviewTitle",
            header: "Title",
            cell: ({ getValue }) => (
                <div style={tableTextStyle} title={String(getValue() ?? "")}>
                    {truncate(String(getValue() ?? ""), 120)}
                </div>
            ),
        },
        {
            accessorKey: "reviewText",
            header: "Text",
            cell: ({ getValue }) => (
                <div
                    style={{
                        ...tableTextStyle,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                    }}
                >
                    {(getValue() as string | null) ?? (
                        <span className="text-muted">None</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "companyReplied",
            header: "Company Replied",
            cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
        },
        {
            accessorKey: "main_category",
            header: "Category",
            cell: ({ getValue }) => (
                <span className="text-capitalize">{String(getValue() ?? "").replaceAll("_", " ")}</span>
            ),
        },
        {
            accessorKey: "reviewerName",
            header: "Reviewer",
            cell: ({ getValue }) => getValue() || <span className="text-muted">Unknown</span>,
        },
        {
            accessorKey: "starRating",
            header: "Star Rating",
            cell: ({ getValue }) => <Stars value={Number(getValue())} />,
        },
        {
            accessorKey: "sentiment",
            header: "Sentiment",
            cell: ({ getValue }) => (
                <span className="text-capitalize">{String(getValue() ?? "").replaceAll("_", " ")}</span>
            ),
        },
        {
            accessorKey: "datePublished",
            header: "Date",
            sortingFn: (a, b, id) =>
                new Date(a.getValue(id) as string).getTime() - new Date(b.getValue(id) as string).getTime(),
            cell: ({ getValue }) => formatDate(getValue() as string),
        },
    ], []);

    const table = useReactTable({
        data: filteredReviews,
        columns: columnDefs,
        state: { sorting, pagination },
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getRowId: (row) => row.id,
    });

    const pageCount = table.getPageCount();
    const paginationItems: Array<number | "ellipsis-left" | "ellipsis-right"> = useMemo(() => {
        const sideWindow = 5;
        if (pageCount <= sideWindow * 2 + 3) {
            return Array.from({ length: pageCount }, (_, i) => i);
        }

        let interiorStart = Math.max(1, pagination.pageIndex - sideWindow);
        let interiorEnd = Math.min(pageCount - 2, pagination.pageIndex + sideWindow);

        const items: Array<number | "ellipsis-left" | "ellipsis-right"> = [0];

        if (interiorStart > 1) {
            items.push("ellipsis-left");
        }

        for (let i = interiorStart; i <= interiorEnd; i += 1) {
            items.push(i);
        }

        if (interiorEnd < pageCount - 2) {
            items.push("ellipsis-right");
        }

        items.push(pageCount - 1);

        return items;
    }, [pageCount, pagination.pageIndex]);

    const formatRangeLabel = useCallback((start: Date, end: Date) => {
        const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "2-digit", year: "numeric" };
        return `${start.toLocaleDateString("en-US", fmt)} - ${end.toLocaleDateString("en-US", fmt)}`;
    }, []);

    return (
        <div className="flex flex-col gap-3 w-full">
            <fieldset
                disabled={isPending}
                style={{
                    border: 0,
                    margin: 0,
                    padding: 0,
                    minWidth: 0,
                    pointerEvents: isPending ? "none" : undefined,
                }}
            >
                <Row className="gy-3 align-items-end">
                    <Col xs={12} lg='auto' className="text-3xl font-semibold">
                        Reviews for domain
                    </Col>
                    <Col xs={12} md>
                        <div className="d-flex align-items-center gap-2">
                            <div className="flex-grow-1">
                                <Select
                                    instanceId="domain-filter"
                                    inputId="domain-filter"
                                    styles={filterSelectStyles}
                                    options={domainOptions}
                                    value={domainOptions.find((o) => o.value === (pendingDomain ?? domain)) ?? null}
                                    onChange={(opt) => {
                                        const nextDomain = opt?.value ?? "";
                                        if (!nextDomain || nextDomain === (pendingDomain ?? domain)) return;
                                        onDomainChange(nextDomain);
                                    }}
                                    isClearable={false}
                                    isDisabled={domainOptions.length === 0 || isPending}
                                    placeholder="Select domain"
                                />
                            </div>
                            {isPending && <Spinner size="sm" className="flex-shrink-0" />}
                        </div>
                    </Col>
                    <Col xs='auto'>
                        <Dropdown>
                            <Dropdown.Toggle
                                variant="outline-bark"
                                className="w-100 text-start rounded-1"
                                disabled={isPending}
                            >
                                {formatRangeLabel(dateRange.start, dateRange.end)}
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                                {dateRangeOptions.map(({ label, days, months, years }) => (
                                    <Dropdown.Item
                                        key={label}
                                        onClick={() => {
                                            const end = new Date();
                                            const start = new Date(end);
                                            if (days) start.setDate(end.getDate() - days);
                                            if (months) start.setMonth(end.getMonth() - months);
                                            if (years) start.setFullYear(end.getFullYear() - years);
                                            setDateRange({ start, end });
                                            onDateRangeChange({ start, end });
                                        }}
                                    >
                                        {label}
                                    </Dropdown.Item>
                                ))}
                                <Dropdown.Divider />
                                <Dropdown.Item onClick={() => setShowRangeModal(true)}>Custom...</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Col>
                </Row>
                <div className="d-flex flex-column gap-3">
                    <Tabs
                        activeKey={activeTab}
                        onSelect={(key) => onTabChange((key as "table" | "metrics") ?? "table")}
                        className="mb-0 reviews-tabs"
                    >
                    <Tab eventKey="table" title="Table">
                        <div className="d-flex flex-column gap-3">
                            <Row className="g-3">
                                <Col xs={6} md={2}>
                                    <Form.Group>
                                        <Form.Label className="mb-1">Sentiment</Form.Label>
                                        <Select
                                            instanceId="sentiment-filter"
                                            inputId="sentiment-filter"
                                            styles={filterSelectStyles}
                                            options={sentimentOptions}
                                            value={sentimentOptions.find((o) => o.value === sentiment) ?? null}
                                            onChange={(opt) => setSentiment(opt?.value ?? "")}
                                            isDisabled={isPending}
                                            isClearable
                                            placeholder="All"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col xs={6} md={2}>
                                    <Form.Group>
                                        <Form.Label className="mb-1">Category</Form.Label>
                                        <Select
                                            instanceId="category-filter"
                                            inputId="category-filter"
                                            styles={filterSelectStyles}
                                            options={categoryOptions}
                                            value={categoryOptions.find((o) => o.value === category) ?? null}
                                            onChange={(opt) => setCategory(opt?.value ?? "")}
                                            isDisabled={isPending}
                                            isClearable
                                            placeholder="All"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col xs={6} md={2}>
                                    <Form.Group>
                                        <Form.Label className="mb-1">Star Rating</Form.Label>
                                        <Select
                                            instanceId="stars-filter"
                                            inputId="stars-filter"
                                            styles={filterSelectStyles}
                                            options={starOptions}
                                            value={starOptions.find((o) => o.value === starFilter) ?? null}
                                            onChange={(opt) => setStarFilter((opt?.value ?? "") as typeof starFilter)}
                                            isDisabled={isPending}
                                            isClearable
                                            placeholder="All"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col xs={12} md={2}>
                                    <Form.Group>
                                        <Form.Label className="mb-1">Company Replied</Form.Label>
                                        <Select
                                            instanceId="reply-filter"
                                            inputId="reply-filter"
                                            styles={filterSelectStyles}
                                            options={replyOptions}
                                            value={replyOptions.find((o) => o.value === replyFilter) ?? null}
                                            onChange={(opt) => setReplyFilter((opt?.value ?? "") as typeof replyFilter)}
                                            isDisabled={isPending}
                                            isClearable
                                            placeholder="All"
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>

                            <Row>
                                <Col>
                                    <div
                                        className="w-100 overflow-auto"
                                        style={{
                                            border: "1px solid #dee2e6",
                                            borderRadius: 4,
                                        }}
                                    >
                                        <Table
                                            striped
                                            hover
                                            style={{
                                                borderCollapse: "separate",
                                                borderSpacing: 0,
                                                marginBottom: 0,
                                                width: "100%",
                                            }}
                                        >
                                            <thead>
                                                {table.getHeaderGroups().map((headerGroup) => (
                                                    <tr key={headerGroup.id}>
                                                        {headerGroup.headers.map((header) => (
                                                            <th
                                                                key={header.id}
                                                                onClick={header.column.getToggleSortingHandler()}
                                                                style={{
                                                                    cursor: "pointer",
                                                                    borderBottom: "1px solid #dee2e6",
                                                                    borderRight: "1px solid #dee2e6",
                                                                    userSelect: "none",
                                                                    minWidth: defaultColumnMinWidth,
                                                                    borderTopLeftRadius:
                                                                        headerGroup.headers[0]?.id === header.id ? 4 : 0,
                                                                    padding: "0.55rem 0.75rem",
                                                                    fontSize: "0.9rem",
                                                                    fontWeight: 600,
                                                                    verticalAlign: "middle",
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                <div className="d-flex align-items-center justify-content-between gap-2 text-nowrap">
                                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                                    <div
                                                                        style={{ fontSize: "0.65rem", lineHeight: 1 }}
                                                                        className="d-flex flex-column align-items-center"
                                                                    >
                                                                        <Fa6SortUp
                                                                            size={14}
                                                                            style={{
                                                                                color: header.column.getIsSorted() === "asc" ? "#555" : "#adb5bd",
                                                                                marginBottom: -7,
                                                                            }}
                                                                        />
                                                                        <Fa6SortDown
                                                                            size={14}
                                                                            style={{
                                                                                color: header.column.getIsSorted() === "desc" ? "#555" : "#adb5bd",
                                                                                marginTop: -7,
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </th>
                                                        ))}
                                                        <th
                                                            style={{
                                                                borderBottom: "1px solid #dee2e6",
                                                                minWidth: actionColumnWidth,
                                                                width: actionColumnWidth,
                                                                maxWidth: actionColumnWidth,
                                                                borderTopRightRadius: 4,
                                                                padding: "0.55rem 0.75rem",
                                                                fontSize: "0.9rem",
                                                                fontWeight: 600,
                                                                textAlign: "left",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            Insights
                                                        </th>
                                                    </tr>
                                                ))}
                                            </thead>
                                            <tbody>
                                                {table.getRowModel().rows.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={columnDefs.length + 1}
                                                            className="text-center border-bottom-0"
                                                            style={{
                                                                padding: "0.85rem",
                                                                fontSize: "0.95rem",
                                                                borderBottomLeftRadius: 4,
                                                                borderBottomRightRadius: 4,
                                                            }}
                                                        >
                                                            No reviews found for the selected filters and date range
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    table.getRowModel().rows.map((row, rowIndex) => {
                                                        const isLastRow = rowIndex === table.getRowModel().rows.length - 1;
                                                        return (
                                                            <tr key={row.id}>
                                                                {row.getVisibleCells().map((cell) => (
                                                                    <td
                                                                        key={cell.id}
                                                                        style={{
                                                                            borderRight: "1px solid #dee2e6",
                                                                            borderBottom: isLastRow ? "none" : "1px solid #dee2e6",
                                                                            verticalAlign: "top",
                                                                            padding: 0,
                                                                            minWidth: defaultColumnMinWidth,
                                                                            borderBottomLeftRadius:
                                                                                isLastRow && row.getVisibleCells()[0]?.id === cell.id ? 4 : 0,
                                                                        }}
                                                                    >
                                                                        <div
                                                                            className={scrollableCellColumns.has(cell.column.id) ? "custom-scroll" : undefined}
                                                                            style={{
                                                                                padding: "0.55rem 0.75rem",
                                                                                fontSize: "0.92rem",
                                                                                ...(scrollableCellColumns.has(cell.column.id)
                                                                                    ? { maxHeight: "92px", overflow: "auto" }
                                                                                    : { overflow: "visible" }),
                                                                                ...(cell.column.id === "reviewText"
                                                                                    ? {
                                                                                        whiteSpace: "pre-wrap",
                                                                                        overflowWrap: "anywhere",
                                                                                        wordBreak: "break-word",
                                                                                    }
                                                                                    : {}),
                                                                            }}
                                                                        >
                                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                                        </div>
                                                                    </td>
                                                                ))}
                                                                <td
                                                                    style={{
                                                                        borderBottom: isLastRow ? "none" : "1px solid #dee2e6",
                                                                        verticalAlign: "top",
                                                                        padding: 0,
                                                                        minWidth: actionColumnWidth,
                                                                        width: actionColumnWidth,
                                                                        maxWidth: actionColumnWidth,
                                                                        borderBottomRightRadius: isLastRow ? 4 : 0,
                                                                    }}
                                                                >
                                                                    <div style={{ padding: "0.55rem 0.75rem" }}>
                                                                        <ReviewDetailsActions review={row.original} />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </Table>
                                    </div>

                                    <div className="d-flex justify-content-center align-items-center mt-2">
                                        <Pagination className="mb-0 reviews-pagination">
                                            <Pagination.First
                                                onClick={() => table.setPageIndex(0)}
                                                disabled={!table.getCanPreviousPage()}
                                            />
                                            <Pagination.Prev
                                                onClick={() => table.previousPage()}
                                                disabled={!table.getCanPreviousPage()}
                                            />
                                            {paginationItems.map((item, idx) =>
                                                typeof item === "number" ? (
                                                    <Pagination.Item
                                                        key={item}
                                                        active={item === pagination.pageIndex}
                                                        onClick={() => table.setPageIndex(item)}
                                                    >
                                                        {item + 1}
                                                    </Pagination.Item>
                                                ) : (
                                                    <Pagination.Ellipsis key={`${item}-${idx}`} disabled />
                                                ),
                                            )}
                                            <Pagination.Next
                                                onClick={() => table.nextPage()}
                                                disabled={!table.getCanNextPage()}
                                            />
                                            <Pagination.Last
                                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                                disabled={!table.getCanNextPage()}
                                            />
                                        </Pagination>
                                    </div>
                                </Col>
                            </Row>
                        </div>
                    </Tab>
                    <Tab eventKey="metrics" title="Metrics">
                        <div className="d-flex flex-column gap-3">
                            {isPending ? (
                                <div
                                    className="d-flex align-items-center justify-content-center border rounded bg-white text-muted"
                                    style={{ minHeight: 320 }}
                                >
                                    <div className="d-flex align-items-center gap-2">
                                        <Spinner size="sm" />
                                        <span>Loading metrics...</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                            <Row className="g-3">
                                <Col md={4}>
                                    <div className="bg-white border rounded p-3 h-100">
                                        <div className="text-muted small">Total Reviews</div>
                                        <div className="display-6 fw-semibold mb-0">{totalDomainReviews}</div>
                                    </div>
                                </Col>
                                <Col md={4}>
                                    <div className="bg-white border rounded p-3 h-100">
                                        <div className="text-muted small">Average Star Rating</div>
                                        <div className="display-6 fw-semibold mb-0 d-flex align-items-center gap-2">
                                            <FaRegStar color={starIconColor} />
                                            <span>{starRatingMetrics.mean?.toFixed(1) ?? "N/A"}</span>
                                        </div>
                                    </div>
                                </Col>
                                <Col md={4}>
                                    <div className="bg-white border rounded p-3 h-100">
                                        <div className="text-muted small">Median Star Rating</div>
                                        <div className="display-6 fw-semibold mb-0 d-flex align-items-center gap-2">
                                            <FaRegStar color={starIconColor} />
                                            <span>{starRatingMetrics.median != null ? Math.round(starRatingMetrics.median) : "N/A"}</span>
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                            <Row className="g-3">
                                <Col xl={4}>
                                    <div className="bg-white border rounded p-3">
                                        <div className="fw-semibold mb-1">Category Distribution</div>
                                        <div className="text-muted small mb-3">
                                            {`Number of reviews per category`}
                                        </div>
                                        {categorySentimentDistribution.length === 0 ? (
                                            <ChartNoData />
                                        ) : (
                                            <div className="w-100 overflow-auto">
                                                <BarChart
                                                    layout="horizontal"
                                                    yAxis={[{
                                                        scaleType: "band",
                                                        data: categorySentimentDistribution.map((item) => item.label),
                                                        tickLabelStyle: {
                                                            fontSize: 11,
                                                            textAnchor: "end",
                                                        },
                                                        width: 130
                                                    }]}
                                                    xAxis={[{
                                                        tickMinStep: 1,
                                                        valueFormatter: (value: number | null) => String(Math.round(Number(value))),
                                                    }]}
                                                    series={[
                                                        {
                                                            data: categorySentimentDistribution.map((item) => item.positive),
                                                            label: "Positive",
                                                            color: chartColors.success,
                                                            stack: "sentiment",
                                                        },
                                                        {
                                                            data: categorySentimentDistribution.map((item) => item.neutral),
                                                            label: "Neutral",
                                                            color: chartColors.primary,
                                                            stack: "sentiment",
                                                        },
                                                        {
                                                            data: categorySentimentDistribution.map((item) => item.negative),
                                                            label: "Negative",
                                                            color: chartColors.danger,
                                                            stack: "sentiment",
                                                        },
                                                    ]}
                                                    height={200}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </Col>
                                <Col xl={4}>
                                    <div className="bg-white border rounded p-3">
                                        <div className="fw-semibold mb-1">Star Rating Distribution</div>
                                        <div className="text-muted small mb-3">
                                            Number of reviews per star rating
                                        </div>
                                        {starRatingMetrics.counts.every((item) => item.count === 0) ? (
                                            <ChartNoData />
                                        ) : (
                                            <div className="w-100 overflow-auto">
                                                <BarChart
                                                    xAxis={[{
                                                        scaleType: "band",
                                                        data: [...starRatingMetrics.counts]
                                                            .sort((a, b) => a.star - b.star)
                                                            .map((item) => `☆ ${item.star}`),
                                                        tickLabelStyle: { fontSize: 13 },
                                                    }]}
                                                    yAxis={[{
                                                        tickMinStep: 1,
                                                        valueFormatter: (value: number | null) => String(Math.round(Number(value))),
                                                    }]}
                                                    series={[{
                                                        data: [...starRatingMetrics.counts]
                                                            .sort((a, b) => a.star - b.star)
                                                            .map((item) => item.count),
                                                        label: "Reviews",
                                                        color: chartColors.primary,
                                                    }]}
                                                    height={200}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </Col>
                                <Col xl={4}>
                                    <div className="bg-white border rounded p-3 h-100">
                                        <div className="fw-semibold mb-1">Overall Sentiment</div>
                                        <div className="text-muted small mb-3">
                                            Percentage of positive, neutral, and negative reviews
                                        </div>
                                        {sentimentPieData.length === 0 ? (
                                            <ChartNoData />
                                        ) : (
                                            <div className="d-flex flex-column align-items-center">
                                                <PieChart
                                                    series={[
                                                        {
                                                            data: sentimentPieData,
                                                            innerRadius: 40,
                                                            outerRadius: 88,
                                                            paddingAngle: 2,
                                                            cornerRadius: 4,
                                                            valueFormatter: (item: {
                                                                label?: string | ((location: "legend" | "tooltip" | "arc") => string);
                                                                value: number;
                                                            }) => {
                                                                const percent = sentimentTotal > 0
                                                                    ? Math.round((item.value / sentimentTotal) * 100)
                                                                    : 0;
                                                                return `${percent}%`;
                                                            },
                                                        },
                                                    ]}
                                                    height={200}
                                                    width={200}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                                </>
                            )}
                        </div>
                    </Tab>
                    </Tabs>
                </div>
            </fieldset>

            <Modal show={showRangeModal} onHide={() => setShowRangeModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Select Date Range</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <form id="range-form">
                        <fieldset
                            disabled={isPending}
                            style={{
                                border: 0,
                                margin: 0,
                                padding: 0,
                                minWidth: 0,
                                pointerEvents: isPending ? "none" : undefined,
                            }}
                        >
                            <div className="d-flex gap-3 align-items-center">
                                <input
                                    type="date"
                                    name="start"
                                    defaultValue={dateRange.start.toISOString().slice(0, 10)}
                                    className="form-control"
                                />
                                <span>to</span>
                                <input
                                    type="date"
                                    name="end"
                                    defaultValue={dateRange.end.toISOString().slice(0, 10)}
                                    className="form-control"
                                />
                            </div>
                        </fieldset>
                    </form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRangeModal(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            const form = document.getElementById("range-form") as HTMLFormElement | null;
                            if (!form) return;
                            const data = new FormData(form);
                            const startRaw = String(data.get("start") ?? "");
                            const endRaw = String(data.get("end") ?? "");
                            if (!startRaw || !endRaw) return;

                            const [sy, sm, sd] = startRaw.split("-").map(Number);
                            const [ey, em, ed] = endRaw.split("-").map(Number);
                            const start = new Date(sy, sm - 1, sd);
                            const end = new Date(ey, em - 1, ed);

                            setDateRange({ start, end });
                            onDateRangeChange({ start, end });
                            setShowRangeModal(false);
                        }}
                    >
                        Apply
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}
