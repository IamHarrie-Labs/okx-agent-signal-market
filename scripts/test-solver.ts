const challenges = [
  // thirty two + fourteen = 46
  'A] LoObBsTtErR] eX^eRrTs] oNnEe] cLlAaWw- fOoRrCeE] ThIrTy] TwO] NoOoTtOoNnSs~ aNd] oTtHhEeRr] cLlAaWw] fOoRrCeE] FoOuRrTtEeEn] NoOoTtOoNnSs{,} WhHaTt] iIs] tH]e] ToOtAaLl] fOoRrCeE/?',
  // thirty five + twenty four = 59
  'A] Lo.oBSt-ErR lOoObSsTtErR ClAw~ HaS tHiRrTy^ fIiVvEe nOoOtToOnSs, AnD] OtHeR ClAw| HaS tW/eNnTy fOoOuR nOoOtToOnSs, WhAt{ Is} ToTaL- FoR^cE?',
  // twenty three + seven = 30
  'A] lO.b StErRr S^wImS[ aT/ tW/eN tY ThReE ~ cEeNtImE tErS| pEr\\ sEeCoNd, aNd- acCeLeRaTeS{ bY< sEeVeN, wHaT> iS/ tHe| nEw- vElOoOcItY?',
];
const expected = [46, 59, 30];

const WORD_NUMS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};

const dedup = (s: string) => s.replace(/(.)\1+/g, '$1');
const matchWordNum = (s: string): number | undefined => {
  const dd = dedup(s);
  for (const [w, v] of Object.entries(WORD_NUMS)) {
    if (dedup(w) === dd) return v;
  }
  return undefined;
};

function parseWordNumbersFromTokens(tokens: string[]): number[] {
  const results: number[] = [];
  let i = 0, current = 0, found = false;
  while (i < tokens.length) {
    let matched = false;
    // Try joining 3, 2, 1 tokens — prefer longer matches (e.g., 'twen'+'ty' = 'twenty')
    for (let w = 3; w >= 1; w--) {
      if (i + w > tokens.length) continue;
      const joined = tokens.slice(i, i + w).join('');
      const val = matchWordNum(joined);
      if (val !== undefined) {
        found = true;
        if (val === 100 || val === 1000) current = (current || 1) * val;
        else current += val;
        i += w;
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (found) { results.push(current); current = 0; found = false; }
      i++;
    }
  }
  if (found) results.push(current);
  return results;
}

function extractOperands(clean: string): [number, number] {
  const parts = clean.split(/\band\b/);
  if (parts.length >= 2) {
    const n1 = parseWordNumbersFromTokens(parts[0].split(/\s+/).filter(Boolean));
    const n2 = parseWordNumbersFromTokens(parts.slice(1).join(' and ').split(/\s+/).filter(Boolean));
    if (n1.length && n2.length) return [n1[n1.length - 1], n2[0]];
  }
  const all = parseWordNumbersFromTokens(clean.split(/\s+/).filter(Boolean));
  return [all[0] ?? 0, all[1] ?? 0];
}

for (let i = 0; i < challenges.length; i++) {
  const challenge = challenges[i];
  // Remove special chars WITHOUT spaces so 'tW/eNnTy' → 'tWeNnTy', but keep real spaces
  const clean = challenge.replace(/[\]\^\/\[\-~\{\}\|\.\,\?!<>\\]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const [n1, n2] = extractOperands(clean);
  const answer = n1 + n2;
  const ok = expected[i] === answer ? '✓' : `✗ expected ${expected[i]}`;
  console.log(`Challenge ${i+1}: n1=${n1} n2=${n2} answer=${answer} ${ok}`);
}
