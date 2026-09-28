// Shared metadata for the GlideRecord rules (SN-GR-*). GlideRecord runs on the server; its legacy
// client-side form is covered by the client rules.
export const GR_CONTEXTS = { contexts: ['any'], excludeContexts: ['client'] };

// Confidence when conditions exist but may be empty at runtime (see filterStrength in glide-record.js).
export const WEAK_FILTER_CONFIDENCE = 0.6;
