import React from "react";

export interface FilterOption {
    value: string;
    label: string;
    icon?: string;
}

interface FilterSelectProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
    id?: string;
}

export default function FilterSelect({ label, value, onChange, options, id }: FilterSelectProps) {
    const selectId = id || `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
    const selected = options.find((o) => o.value === value);

    return (
        <div className="filter-select-group">
            <label className="filter-select-label" htmlFor={selectId}>{label}</label>
            <div className="filter-select-wrap">
                {selected?.icon && <span className="filter-select-icon" aria-hidden="true">{selected.icon}</span>}
                <select
                    id={selectId}
                    className="filter-select"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.icon ? `${opt.icon} ${opt.label}` : opt.label}
                        </option>
                    ))}
                </select>
                <span className="filter-select-chevron" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                        <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    </svg>
                </span>
            </div>
        </div>
    );
}
