/* Mock HOA governing document for the demo's HOA/strata scenario.
   Fictional community ("Elmwood Heights"); clause language adapted from real public
   CC&R / architectural-standards sources (hopb.co, findhoalaw.com). Loaded as a global
   to avoid file:// fetch/CORS issues. */
window.HOA_DOC = {
  title: "Elmwood Heights — Architectural & Exterior Standards",
  subtitle: "Community Association · Strata Title · Adopted 2024",
  sections: [
    { num: "1", heading: "Purpose & Authority", clauses: [
      { id: "1.1", text: "These Standards are adopted by the Association under the Declaration of Covenants, Conditions & Restrictions (CC&Rs) to preserve the aesthetic quality, uniformity, and property values of the community." },
      { id: "1.2", text: "Where these Standards clarify an ambiguous provision of the CC&Rs, they shall be applied consistently and in good faith to all members." },
    ]},
    { num: "2", heading: "Maintenance Obligations", clauses: [
      { id: "2.1", text: "The Association maintains, repairs, and replaces the common areas. Each homeowner maintains their separate interest, including the exterior surfaces of their dwelling, except where expressly assigned to the Association." },
      { id: "2.2", text: "Routine upkeep of an exterior surface (cleaning, touch-up, refinishing) is the homeowner's responsibility. Structural repair of common elements is the Association's responsibility. Ambiguous cases are resolved by the Board." },
    ]},
    { num: "3", heading: "General Exterior Appearance", clauses: [
      { id: "3.1", text: "All dwellings shall present a clean, well-maintained, and uniform exterior appearance consistent with the community's adopted scheme." },
      { id: "3.2", text: "Visible deterioration — including fading, staining, or surface damage — shall be remedied promptly by the responsible party." },
    ]},
    { num: "4", heading: "Exterior Surfaces & Finishes", clauses: [
      { id: "4.1", text: "Approved materials & finishes. Exterior cladding, trim, and corner boards shall use materials and finishes from the Association's approved schedule. Substitutions require Architectural Committee approval." },
      { id: "4.2", text: "Surface integrity. All visible exterior surfaces — siding, trim, corners, and fascia — shall be maintained free of chips, cracks, peeling, and exposed substrate. The homeowner shall remedy any such condition within thirty (30) days of written notice, using association-approved materials and colours per §4.3." },
      { id: "4.3", text: "Colour palette & approval. Exterior repairs and repainting must conform to the Association's approved colour scheme. Use of any colour outside the approved palette requires prior written approval and may be refused to preserve community uniformity." },
      { id: "4.4", text: "Architectural review. Visible exterior modifications and non-like-for-like repairs require prior approval by the Architectural Committee, which shall respond within thirty (30) days of a complete application. Like-for-like remediation under §4.2 using approved materials does not require pre-approval." },
    ]},
    { num: "5", heading: "Landscaping & Common Areas", clauses: [
      { id: "5.1", text: "The Association maintains community landscaping and shared grounds. Homeowners shall not alter common-area planting or hardscape without approval." },
      { id: "5.2", text: "Personal exterior items (fixtures, signage, decorations) shall comply with the General Exterior Appearance standards in §3." },
    ]},
  ],
};
