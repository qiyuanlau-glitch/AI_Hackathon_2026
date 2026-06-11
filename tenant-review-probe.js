globalThis.__probe = async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const change = el => el.dispatchEvent(new Event('change', { bubbles: true }));
  const input = el => el.dispatchEvent(new Event('input', { bubbles: true }));
  const firstValue = select => Array.from(select.options).find(option => option.value)?.value || '';

  document.getElementById('f-desc').value = 'broken door';
  input(document.getElementById('f-desc'));
  document.getElementById('f-unit').value = '7A';
  input(document.getElementById('f-unit'));

  const category = document.getElementById('f-category');
  category.value = Array.from(category.options).find(option => option.textContent.trim() === 'Doors')?.value || firstValue(category);
  change(category);
  await wait(50);

  const type = document.getElementById('f-type');
  type.value = firstValue(type);
  change(type);
  await wait(50);

  const code = document.getElementById('f-code');
  if (!code.disabled){
    code.value = firstValue(code);
    change(code);
  }

  const fileInput = document.getElementById('f-photos');
  const dt = new DataTransfer();
  dt.items.add(new File(['x'], 'door.png', { type: 'image/png' }));
  fileInput.files = dt.files;
  change(fileInput);
  await wait(50);

  document.getElementById('submitBtn').click();
  for (let i = 0; i < 80 && !document.getElementById('s-summary'); i++) await wait(100);

  const summary = document.getElementById('s-summary');
  const text = summary ? summary.textContent : '';
  return [
    ['summary rendered', Boolean(summary)],
    ['description is read-only', document.getElementById('f-desc')?.hasAttribute('readonly')],
    ['category select is disabled', document.getElementById('f-category')?.disabled],
    ['inspection section hidden', !text.includes('Need an inspection instead?') && !document.getElementById('f-inspect')],
    ['photo upload label hidden', !text.includes('Add photos')],
    ['submitted photo thumbnail visible', summary?.querySelectorAll('.thumb img').length === 1],
    ['agent response visible', text.includes('Agent response')],
    ['billing tile visible', text.includes('No cost to you') || text.includes('Billed to')],
    ['old summary sections removed', !text.includes('Assigned to') && !text.includes('Your contact') && !text.includes('What we understood') && !text.includes('Agent decision')],
  ];
};
