"use client";

import { useMemo, useState } from "react";
import { Table, Row, Col, Form } from "react-bootstrap";
import Select, { type StylesConfig } from "react-select";
import { FaSortDown as Fa6SortDown, FaSortUp as Fa6SortUp } from "react-icons/fa6";
import DomainsDateRangeDropdown from "@/components/DomainsDateRangeDropdown";
import DomainReviewsRowButton from "@/components/DomainReviewsRowButton";

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
type FilterOption = { value: string; label: string };

const defaultColumnMinWidth = 150;

const filterSelectStyles: StylesConfig<FilterOption, false> = {
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
};

function percent(value: number) {
    return `${value.toFixed(1)}%`;
}

function trustpilotReviewUrl(domain: string) {
    return `https://www.trustpilot.com/review/${encodeURIComponent(domain)}?languages=all`;
}

function sortRows(rows: DomainMetricRow[], sort: SortKey, dir: SortDir) {
    const direction = dir === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
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
}

function SortHeader({
    label,
    sortKey,
    currentSort,
    currentDir,
    onSort,
}: {
    label: string;
    sortKey: SortKey;
    currentSort: SortKey;
    currentDir: SortDir;
    onSort: (sortKey: SortKey) => void;
}) {
    const isActive = currentSort === sortKey;

    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className="w-100 text-start p-0 border-0 bg-transparent text-reset d-block"
            style={{ cursor: "pointer" }}
        >
            <div className="d-flex align-items-center justify-content-between gap-2 text-nowrap">
                <span>{label}</span>
                <div style={{ fontSize: "0.65rem", lineHeight: 1 }} className="d-flex flex-column align-items-center">
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
        </button>
    );
}

export default function DomainsMetricsTableClient({
    rows,
    range,
    sort,
    dir,
    startParam,
    endParam,
}: {
    rows: DomainMetricRow[];
    range: { start: string; end: string };
    sort: SortKey;
    dir: SortDir;
    startParam?: string;
    endParam?: string;
}) {
    const [topNegativeCategoryFilter, setTopNegativeCategoryFilter] = useState("");
    const [currentSort, setCurrentSort] = useState<SortKey>(sort);
    const [currentDir, setCurrentDir] = useState<SortDir>(dir);

    const topNegativeCategoryOptions = useMemo(
        () => {
            const counts = new Map<string, number>();

            for (const row of rows) {
                const key = row.topNegativeCategory;
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
        },
        [rows],
    );

    const filteredRows = useMemo(
        () =>
            rows.filter((row) => {
                if (!topNegativeCategoryFilter) return true;
                return row.topNegativeCategory === topNegativeCategoryFilter;
            }),
        [rows, topNegativeCategoryFilter],
    );
    const sortedFilteredRows = useMemo(
        () => sortRows(filteredRows, currentSort, currentDir),
        [filteredRows, currentSort, currentDir],
    );

    const filterOptions: FilterOption[] = topNegativeCategoryOptions.map((value) => ({ value, label: value }));

    const onSort = (sortKey: SortKey) => {
        if (currentSort === sortKey) {
            setCurrentDir((prev) => (prev === "desc" ? "asc" : "desc"));
            return;
        }
        setCurrentSort(sortKey);
        setCurrentDir("desc");
    };

    return (
        <div className="flex flex-col gap-3 w-full">
            <Row className="gy-3 align-items-end">
                <Col className="text-3xl font-semibold">Domains</Col>
                <Col xs="auto">
                    <DomainsDateRangeDropdown start={range.start} end={range.end} sort={currentSort} dir={currentDir} />
                </Col>
            </Row>

            <Row className="g-3">
                <Col xs={12} md={4}>
                    <Form.Group>
                        <Form.Label className="mb-1">Top Negative Category</Form.Label>
                        <div style={{ minWidth: 280 }}>
                            <Select
                                instanceId="top-negative-category-filter"
                                inputId="top-negative-category-filter"
                                styles={filterSelectStyles}
                                options={filterOptions}
                                value={filterOptions.find((o) => o.value === topNegativeCategoryFilter) ?? null}
                                onChange={(opt) => setTopNegativeCategoryFilter(opt?.value ?? "")}
                                isClearable
                                placeholder="All"
                            />
                        </div>
                    </Form.Group>
                </Col>
            </Row>

            <Row>
                <Col>
                    <div
                        className="w-100 overflow-auto"
                        style={{ border: "1px solid #dee2e6", borderRadius: 4, maxHeight: "62vh" }}
                    >
                        <Table
                            striped
                            hover
                            style={{
                                borderCollapse: "separate",
                                borderSpacing: 0,
                                marginBottom: 0,
                                width: "100%",
                                minWidth: 1120,
                            }}
                        >
                            <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "#fff" }}>
                                <tr>
                                    <th style={{ borderBottom: "1px solid #dee2e6", borderRight: "1px solid #dee2e6", minWidth: 220, borderTopLeftRadius: 4, padding: "0.55rem 0.75rem", fontSize: "0.9rem", fontWeight: 600, verticalAlign: "middle", whiteSpace: "nowrap", background: "#fff" }}>
                                        <SortHeader label="Domain" sortKey="domain" currentSort={currentSort} currentDir={currentDir} onSort={onSort} />
                                    </th>
                                    <th style={{ borderBottom: "1px solid #dee2e6", borderRight: "1px solid #dee2e6", minWidth: defaultColumnMinWidth, padding: "0.55rem 0.75rem", fontSize: "0.9rem", fontWeight: 600, verticalAlign: "middle", whiteSpace: "nowrap", background: "#fff" }}>
                                        <SortHeader label="# Reviews" sortKey="numReviews" currentSort={currentSort} currentDir={currentDir} onSort={onSort} />
                                    </th>
                                    <th style={{ borderBottom: "1px solid #dee2e6", borderRight: "1px solid #dee2e6", minWidth: defaultColumnMinWidth, padding: "0.55rem 0.75rem", fontSize: "0.9rem", fontWeight: 600, verticalAlign: "middle", whiteSpace: "nowrap", background: "#fff" }}>
                                        <SortHeader label="Avg Star" sortKey="avgStarRating" currentSort={currentSort} currentDir={currentDir} onSort={onSort} />
                                    </th>
                                    <th style={{ borderBottom: "1px solid #dee2e6", borderRight: "1px solid #dee2e6", minWidth: defaultColumnMinWidth, padding: "0.55rem 0.75rem", fontSize: "0.9rem", fontWeight: 600, verticalAlign: "middle", whiteSpace: "nowrap", background: "#fff" }}>
                                        <SortHeader label="% Negative" sortKey="negativePct" currentSort={currentSort} currentDir={currentDir} onSort={onSort} />
                                    </th>
                                    <th style={{ borderBottom: "1px solid #dee2e6", borderRight: "1px solid #dee2e6", minWidth: defaultColumnMinWidth, padding: "0.55rem 0.75rem", fontSize: "0.9rem", fontWeight: 600, verticalAlign: "middle", whiteSpace: "nowrap", background: "#fff" }}>
                                        <SortHeader label="% Positive" sortKey="positivePct" currentSort={currentSort} currentDir={currentDir} onSort={onSort} />
                                    </th>
                                    <th style={{ borderBottom: "1px solid #dee2e6", borderRight: "1px solid #dee2e6", minWidth: 240, padding: "0.55rem 0.75rem", fontSize: "0.9rem", fontWeight: 600, verticalAlign: "middle", whiteSpace: "nowrap", background: "#fff" }}>
                                        <SortHeader label="Top Negative Category" sortKey="topNegativeCategory" currentSort={currentSort} currentDir={currentDir} onSort={onSort} />
                                    </th>
                                    <th style={{ borderBottom: "1px solid #dee2e6", minWidth: 120, borderTopRightRadius: 4, padding: "0.55rem 0.75rem", fontSize: "0.9rem", fontWeight: 600, verticalAlign: "middle", whiteSpace: "nowrap", background: "#fff", textAlign: "left" }}>
                                        Reviews
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedFilteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center border-bottom-0" style={{ padding: "0.85rem", fontSize: "0.95rem", borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}>
                                            No domain metrics available for the selected filters/date range
                                        </td>
                                    </tr>
                                ) : (
                                    sortedFilteredRows.map((row, rowIndex) => {
                                        const isLastRow = rowIndex === sortedFilteredRows.length - 1;
                                        const baseCellStyle = {
                                            borderBottom: isLastRow ? "none" : "1px solid #dee2e6",
                                            verticalAlign: "top" as const,
                                            padding: 0,
                                            minWidth: defaultColumnMinWidth,
                                        };

                                        return (
                                            <tr key={row.domain}>
                                                <td style={{ ...baseCellStyle, borderRight: "1px solid #dee2e6", minWidth: 220, borderBottomLeftRadius: isLastRow ? 4 : 0 }}>
                                                    <div style={{ padding: "0.55rem 0.75rem", fontSize: "0.92rem", whiteSpace: "nowrap" }}>
                                                        <a
                                                            href={trustpilotReviewUrl(row.domain)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{
                                                                color: "#0d6efd",
                                                                textDecoration: "underline",
                                                                textUnderlineOffset: "2px",
                                                            }}
                                                        >
                                                            {row.domain}
                                                        </a>
                                                    </div>
                                                </td>
                                                <td style={{ ...baseCellStyle, borderRight: "1px solid #dee2e6" }}>
                                                    <div style={{ padding: "0.55rem 0.75rem", fontSize: "0.92rem" }}>{row.numReviews.toLocaleString("en-US")}</div>
                                                </td>
                                                <td style={{ ...baseCellStyle, borderRight: "1px solid #dee2e6" }}>
                                                    <div style={{ padding: "0.55rem 0.75rem", fontSize: "0.92rem" }}>{row.avgStarRating == null ? "N/A" : row.avgStarRating.toFixed(2)}</div>
                                                </td>
                                                <td style={{ ...baseCellStyle, borderRight: "1px solid #dee2e6" }}>
                                                    <div style={{ padding: "0.55rem 0.75rem", fontSize: "0.92rem" }}>{percent(row.negativePct)}</div>
                                                </td>
                                                <td style={{ ...baseCellStyle, borderRight: "1px solid #dee2e6" }}>
                                                    <div style={{ padding: "0.55rem 0.75rem", fontSize: "0.92rem" }}>{percent(row.positivePct)}</div>
                                                </td>
                                                <td style={{ ...baseCellStyle, minWidth: 240, borderRight: "1px solid #dee2e6" }}>
                                                    <div style={{ padding: "0.55rem 0.75rem", fontSize: "0.92rem" }}>
                                                        {row.topNegativeCategory ?? <span className="text-muted">N/A</span>}
                                                    </div>
                                                </td>
                                                <td style={{ ...baseCellStyle, minWidth: 120, borderBottomRightRadius: isLastRow ? 4 : 0 }}>
                                                    <div style={{ padding: "0.55rem 0.75rem", fontSize: "0.92rem" }}>
                                                        <DomainReviewsRowButton domain={row.domain} start={range.start.slice(0, 10)} end={range.end.slice(0, 10)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Col>
            </Row>
        </div>
    );
}
