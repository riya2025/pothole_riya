/**
 * Clerk publishable key for Create React App.
 * Set REACT_APP_CLERK_PUBLISHABLE_KEY in .env.local (local) or Vercel (production).
 * Note: VITE_* vars do not work with react-scripts — use REACT_APP_* only.
 */
function readClerkPublishableKey(): string {
    const raw =
        process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ||
        process.env.VITE_CLERK_PUBLISHABLE_KEY ||
        "";
    return raw.trim().replace(/^["']|["']$/g, "").replace(/\$$/, "");
}

export const CLERK_PUBLISHABLE_KEY = readClerkPublishableKey();

export const isClerkEnabled = CLERK_PUBLISHABLE_KEY.startsWith("pk_");

/** Where users land after Google / email sign-in */
export const CLERK_AFTER_AUTH_URL = "/map";

/** Where users land after sign-out (home / map landing) */
export const CLERK_AFTER_SIGN_OUT_URL = "/";

export const clerkAppearance = {
    variables: {
        colorPrimary: "#4f46e5",
        colorBackground: "#ffffff",
        colorText: "#0f172a",
        colorTextSecondary: "#475569",
        colorInputBackground: "#f8fafc",
        colorInputText: "#0f172a",
        borderRadius: "12px",
    },
    elements: {
        rootBox: { width: "100%" },
        card: {
            background: "#ffffff",
            border: "1px solid rgba(15,23,42,0.1)",
            boxShadow: "0 20px 50px rgba(15,23,42,0.12)",
        },
        headerTitle: { color: "#0f172a", fontWeight: 700 },
        headerSubtitle: { color: "#475569" },
        socialButtonsBlockButton: {
            border: "1px solid rgba(15,23,42,0.1)",
            background: "#f8fafc",
            color: "#0f172a",
        },
        socialButtonsBlockButtonText: { color: "#0f172a", fontWeight: 600 },
        dividerLine: { background: "rgba(15,23,42,0.1)" },
        dividerText: { color: "#94a3b8" },
        formFieldLabel: { color: "#475569", fontWeight: 600 },
        formFieldInput: {
            background: "#f8fafc",
            border: "1px solid rgba(15,23,42,0.1)",
            color: "#0f172a",
        },
        formButtonPrimary: {
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            fontWeight: 700,
        },
        footerActionLink: { color: "#4f46e5", fontWeight: 600 },
        identityPreviewEditButton: { color: "#4f46e5" },
        formResendCodeLink: { color: "#4f46e5" },
        otpCodeFieldInput: {
            background: "#f8fafc",
            border: "1px solid rgba(15,23,42,0.1)",
            color: "#0f172a",
        },
    },
};
