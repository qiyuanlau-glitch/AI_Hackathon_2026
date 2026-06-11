window.LessenSupabaseConfig = {
  url: 'https://sehxhnbplcefinnllqnf.supabase.co',
  key: 'sb_publishable_lITx-rrGDslC897n1YZzog_0KzlevUh',
  tables: {
    workOrders: 'work_orders',
    messages: 'work_order_messages',
  },
  // Knowledge base lives in Supabase Storage (bucket "hackathon"). Once the bucket
  // is public this stable URL works without a token; until then the runtime falls
  // back to the bundled ./knowledge_base.json copy. Adding clauses in Supabase
  // flows to the violation + guideline agents automatically — no code change.
  knowledgeBaseUrl: 'https://sehxhnbplcefinnllqnf.supabase.co/storage/v1/object/public/hackathon/knowledge_base.json',
};
