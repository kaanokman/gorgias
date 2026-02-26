"use client";

import { useRouter } from "next/navigation";
import { OverlayTrigger, Tooltip, Button } from "react-bootstrap";
import { FaRegStar } from "react-icons/fa";

export default function DomainReviewsRowButton({
    domain,
    start,
    end,
}: {
    domain: string;
    start: string;
    end: string;
}) {
    const router = useRouter();

    return (
        <OverlayTrigger trigger={["hover", "focus"]} overlay={<Tooltip>View reviews</Tooltip>}>
            <span className="d-inline-flex">
                <Button
                    variant="outline-bark"
                    onClick={() => {
                        const params = new URLSearchParams();
                        params.set("domain", domain);
                        params.set("start", start);
                        params.set("end", end);
                        params.set("tab", "metrics");
                        router.push(`/dashboard/reviews?${params.toString()}`);
                    }}
                    style={{ height: 36, width: 36 }}
                    className="p-0 d-flex justify-content-center align-items-center"
                    aria-label={`View reviews for ${domain}`}
                >
                    <FaRegStar size={16} />
                </Button>
            </span>
        </OverlayTrigger>
    );
}
