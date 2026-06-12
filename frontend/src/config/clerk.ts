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

/** Placeholder-only labels; * marks required fields; last name is optional */
export const clerkLocalization = {
    formFieldInputPlaceholder__firstName: "First name *",
    formFieldInputPlaceholder__lastName: "Last name (optional)",
    formFieldInputPlaceholder__emailAddress: "Email address *",
    formFieldInputPlaceholder__signUpPassword: "Create a password *",
    formFieldInputPlaceholder__password: "Password *",
    formFieldInputPlaceholder__emailAddress_username: "Email or username *",
    signIn: {
        start: {
            subtitle: "",
            title: "Sign in",
        },
    },
    signUp: {
        start: {
            subtitle: "",
            title: "Create account",
        },
    },
};

export const clerkAppearance = {
    variables: {
        colorPrimary: "#818cf8",
        colorBackground: "#131620",
        colorText: "#F8FAFC",
        colorTextSecondary: "#94A3B8",
        colorInputBackground: "rgba(15, 18, 26, 0.8)",
        colorInputText: "#F8FAFC",
        borderRadius: "12px",
    },
    elements: {
        rootBox: { width: "100%" },
        card: {
            background: "rgba(23, 27, 40, 0.65)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        },
        headerTitle: { color: "#F8FAFC", fontWeight: 700 },
        headerSubtitle: { display: "none" },
        footerPages: { display: "none" },
        socialButtonsBlockButton: {
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            color: "#F8FAFC",
        },
        socialButtonsBlockButtonText: { color: "#F8FAFC", fontWeight: 600 },
        dividerLine: { background: "rgba(255,255,255,0.08)" },
        dividerText: { color: "#64748b" },
        formFieldLabel: { display: "none" },
        formFieldLabelRow: { display: "none" },
        formFieldHintText: { display: "none" },
        formFieldInput: {
            background: "rgba(15, 18, 26, 0.8)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#F8FAFC",
        },
        formButtonPrimary: {
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            fontWeight: 700,
        },
        footerActionLink: { color: "#818cf8", fontWeight: 600 },
        identityPreviewEditButton: { color: "#818cf8" },
        formResendCodeLink: { color: "#818cf8" },
        otpCodeFieldInput: {
            background: "rgba(15, 18, 26, 0.8)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#F8FAFC",
        },
    },
};
