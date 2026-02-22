export interface VoicemailType {
    id?: number;
    phone_number: string;
    patient: string | null;
    reason: string | null;
    suggestion: string | null;
    urgency: string | null;
    timestamp: string;
    status: string;
}

export type VoicemailFormData = {
    phone_number: string;
    audio: FileList;
};

export interface ReviewType {
    id: string;
    domain: string;
    reviewText: string | null;
    reviewTitle: string;
    starRating: number;
    datePublished: string;
    reviewerName: string;
    companyReplied: boolean;
    sentiment: string;
    main_category: string;
    key_pain_point: string | null;
    actionable_insight: string | null;
}
