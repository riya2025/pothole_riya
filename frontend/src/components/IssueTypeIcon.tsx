import React from "react";
import { issueIcon, issueImageUrl, normalizeIssueType } from "../utils/helpers";

interface IssueTypeIconProps {
    type: string;
    size?: number;
    className?: string;
}

export default function IssueTypeIcon({ type, size = 22, className = "" }: IssueTypeIconProps) {
    const src = issueImageUrl(type);
    const label = normalizeIssueType(type);

    if (src) {
        return (
            <img
                src={src}
                alt={label}
                className={`issue-type-icon ${className}`.trim()}
                width={size}
                height={size}
            />
        );
    }

    return (
        <span className={`issue-type-emoji ${className}`.trim()} aria-hidden>
            {issueIcon(type)}
        </span>
    );
}
