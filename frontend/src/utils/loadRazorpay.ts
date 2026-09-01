declare global {
  interface Window {
    Razorpay?: new (options: any) => { open: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;

/**
 * Loads Razorpay's checkout script on demand — only when a page that can
 * actually open checkout needs it (print-book, checkout), instead of on
 * every page via a global <script> tag. Before checkout is opened, Razorpay's
 * own script otherwise tries (and fails) to prefetch an internal asset on
 * every page load, which is the noise this replaces.
 * Safe to call multiple times — loads the script at most once, and every
 * caller awaits the same in-flight load.
 */
export function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a retry on the next call
      reject(new Error("Failed to load Razorpay checkout script"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}
