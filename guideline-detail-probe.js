globalThis.__probe = async () => {
  // Smoke test: the page parsed (no JS syntax error) and the lazy-guideline
  // wiring is present. Also exercise the pure input builder.
  const checks = [];

  checks.push(['page initialized', typeof showWorkOrderDetail === 'function']);
  checks.push(['ensureWorkOrderRisks defined', typeof ensureWorkOrderRisks === 'function']);
  checks.push(['buildViolationInputFromItem defined', typeof buildViolationInputFromItem === 'function']);
  checks.push(['violationsToGuideline defined', typeof violationsToGuideline === 'function']);
  checks.push([
    'LessenSupabase.updateWorkOrderGuideline defined',
    Boolean(window.LessenSupabase) && typeof window.LessenSupabase.updateWorkOrderGuideline === 'function',
  ]);

  // Build an input from a synthetic stored work order and verify the shape the
  // violation agent expects.
  const item = {
    orderId: 'WO-2026-777',
    category: 'Plumbing',
    serviceType: 'Leak',
    problemCode: 'PIPE-LEAK',
    address: '12 Demo Street',
    photos: [{ fileName: 'leak.png', filePath: 'https://example.com/leak.png' }],
    raw: { communications: [{ from: 'Tenant', to: 'Affiliate', message: 'still leaking' }] },
  };
  let built = null;
  try { built = buildViolationInputFromItem(item); } catch (e) { built = { error: String(e) }; }
  checks.push(['input wo_id mapped', built && built.work_order && built.work_order.wo_id === 'WO-2026-777']);
  checks.push(['input service_type mapped', built && built.work_order && built.work_order.service_type === 'Leak']);
  checks.push(['input attachment url mapped', built && built.work_order && built.work_order.attachments?.[0]?.url === 'https://example.com/leak.png']);
  checks.push(['input communications mapped', built && built.work_order && built.work_order.communications?.[0]?.message === 'still leaking']);
  checks.push(['input carries no knowledge base', built && !('knowledge_base' in built) && !('files' in built)]);

  // violationsToGuideline converts agent output into the guideline shape the
  // detail panels read (risks[]).
  const guideline = violationsToGuideline({
    overall_risk_level: 'medium',
    violations: [{ violation_summary: 'No exterior paint', recommended_action: 'Notify HOA', policy_name: 'HOA 4.2' }],
  });
  checks.push(['guideline has risks[]', Boolean(guideline) && Array.isArray(guideline.risks) && guideline.risks.length === 1]);

  return checks;
};
