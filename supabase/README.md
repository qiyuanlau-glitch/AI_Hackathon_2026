# Supabase Setup

This repo is now wired for GitHub Pages/static hosting. Work orders are saved from the browser directly to Supabase REST using the project URL and a publishable/legacy anon key.

## Steps

1. Open the Supabase SQL editor.
2. Run `supabase/schema.sql`.
3. Push to GitHub.

`supabase-config.js` is already set to:

```js
window.LessenSupabaseConfig = {
  url: 'https://sehxhnbplcefinnllqnf.supabase.co',
  key: 'sb_publishable_lITx-rrGDslC897n1YZzog_0KzlevUh',
  tables: {
    workOrders: 'work_orders',
    messages: 'work_order_messages',
  },
};
```

Use a publishable key or legacy anon key only. Never put a Supabase secret key or service-role key in this repo.

The SQL policies are intentionally open for a hackathon demo. They allow anonymous browser users to read, create, and update demo work orders.
