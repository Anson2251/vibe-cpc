declare global {
    interface Window {
        prompt?: (message?: string | undefined, _default?: string | undefined) => string | null
    }
}
