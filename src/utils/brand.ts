export function normalizeBrandName(s: string) {
  const d = (s || '').toLowerCase();
  const map: Record<string, string> = {
    'hm.com': 'H&M',
    'h-m.com': 'H&M',
    'zara.com': 'Zara',
    'asos.com': 'ASOS',
  };
  for (const k of Object.keys(map)) if (d.includes(k)) return map[k];
  const m = d.match(/([a-z0-9-]+)\.(com|net|org|io|co|shop|store)/i);
  const brand = m?.[1] || d.split('@')[1]?.split('.')[0] || d;
  return brand.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function firstUnsubLink(v: string) {
  const urls = v?.match(/<([^>]+)>/g)?.map((s) => s.slice(1, -1)) ?? [];
  return urls.find((u) => u.startsWith('http')) || urls[0] || '';
}
