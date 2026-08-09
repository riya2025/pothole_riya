import React from "react";

type IconProps = { className?: string; size?: number };

function Svg({
    size = 20,
    className,
    children,
}: IconProps & { children: React.ReactNode }) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            {children}
        </svg>
    );
}

export function GalleryIcon(props: IconProps) {
    return (
        <Svg {...props}>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="M3 16l5-4 4 3 3-2 6 5" />
        </Svg>
    );
}

export function MicIcon(props: IconProps) {
    return (
        <Svg {...props}>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
            <path d="M8 21h8" />
        </Svg>
    );
}

export function FlashIcon({ on, ...props }: IconProps & { on?: boolean }) {
    return (
        <Svg {...props}>
            {on ? (
                <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor" stroke="none" />
            ) : (
                <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
            )}
        </Svg>
    );
}

export function PlusIcon(props: IconProps) {
    return (
        <Svg {...props}>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </Svg>
    );
}
