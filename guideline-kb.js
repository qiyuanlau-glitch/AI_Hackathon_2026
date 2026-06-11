/* Guideline knowledge base — mock data for the Elmwood Heights community policy.
   Loaded via <script src> to expose window.GUIDELINE_KB (avoids file:// CORS).
   Article C only (Gardening); other articles are out of scope for this demo. */
(function(){
  window.GUIDELINE_KB = {
    policyName: 'Elmwood Heights Community Policy',
    articles: [
      {
        id: 'C',
        title: 'Gardening',
        clauses: [
          {
            id: 'C1',
            title: 'Trimming of trees',
            text: 'Trees may only be trimmed into the shape of a circle.',
          },
          {
            id: 'C2',
            title: 'Cutting down trees',
            text: 'Only trees deemed dying or browning by a panel gardener may be cut down.',
          },
          {
            id: 'C3',
            title: 'Planting flowers',
            text: 'Residents may not plant flowers that were not originally there without prior approval.',
          },
        ],
      },
    ],
  };
})();
