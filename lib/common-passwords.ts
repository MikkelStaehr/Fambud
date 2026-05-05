// Blocklist over almindelige passwords der dukker op i breach-data.
// Listen er kurateret til 8+ tegn (matcher vores password-minimum) og
// inkluderer både engelske og danske mønstre.
//
// Dette er ikke fuld dækning - HaveIBeenPwned k-anonymity API ville give
// stærkere beskyttelse. Men listen fanger de værste low-hanging fruits
// hvor brugeren bevidst valgte noget trivielt der ville falde for første
// brute-force-attempt.
//
// Sammenligning sker case-insensitive (lowercase normalisering). Vi har
// typiske case-varianter eksplicit listet for at fange "Password123" der
// tit kommer fra "minimum 8 tegn + 1 stort + 1 tal"-policies.

const COMMON_PASSWORDS = new Set<string>([
  // Top fra breach-data (RockYou, Collection #1 osv.)
  'password',
  'password1',
  'password!',
  'password12',
  'password123',
  'password1234',
  'password!1',
  'pa55word',
  'p@ssw0rd',
  'p@ssword1',
  'p@ssword123',

  // Talkæder
  '12345678',
  '123456789',
  '1234567890',
  '11111111',
  '00000000',
  '88888888',
  '12121212',
  '123123123',
  '321321321',
  '147258369',
  '1234abcd',
  'abcd1234',

  // Keyboard walks
  'qwerty123',
  'qwertyui',
  'qwertyuiop',
  'qwertyu1',
  '1qaz2wsx',
  '2wsx3edc',
  '1q2w3e4r',
  '1q2w3e4r5t',
  '!qaz@wsx',
  'asdfghjk',
  'asdfghjkl',
  'asdf1234',
  'qazwsxedc',
  'zxcvbnm1',
  'zxcvbnm123',

  // Romance / familie / sport
  'iloveyou',
  'iloveyou1',
  'iloveyou123',
  'princess',
  'princess1',
  'princess123',
  'football',
  'football1',
  'football123',
  'baseball',
  'baseball1',
  'monkey12',
  'monkey123',
  'dragon12',
  'dragon123',
  'shadow12',
  'shadow123',
  'master12',
  'master123',
  'sunshine',
  'sunshine1',
  'starwars',
  'superman',
  'computer',
  'computer1',

  // Welcome / admin / login
  'welcome1',
  'welcome12',
  'welcome123',
  'admin123',
  'admin1234',
  'administrator',
  'letmein1',
  'letmein12',
  'letmein123',
  'changeme',
  'changeme1',

  // Danske mønstre
  'kodeord1',
  'kodeord12',
  'kodeord123',
  'kodeord!',
  'danmark1',
  'danmark12',
  'danmark123',
  'kobenhavn',
  'aarhus123',
  'familie1',
  'familie12',
  'familie123',
  'sommerferie',
  'sommerferie1',
  'vinterferie',
  'lykkelig1',

  // Trust / hello / general
  'trustno1',
  'hello123',
  'hello1234',
  'qwerty12',
  'qwerty1!',

  // Disney / fiktion
  'mickey12',
  'mickey123',
  'mickeymouse',
  'pokemon1',
  'pokemon12',
  'pokemon123',
  'batman123',
  'spiderman',

  // Year-baserede (typisk "season + year")
  'summer24',
  'summer2024',
  'summer2025',
  'summer2026',
  'winter24',
  'winter2024',
  'winter2025',
  'spring24',
  'spring2024',
  'efterar24',
  'efter2024',

  // Almindelige navne + 1
  'michael1',
  'jordan23',
  'jennifer',
  'jennifer1',
  'matthew1',
  'jessica1',
  'nicholas',
  'andersen',
  'jensen123',
  'hansen123',
  'pedersen',

  // Tilfældige der ofte ses
  'cookie123',
  'iloveyou2',
  'pussy123',
  'fuckyou1',
  'asshole1',
]);

/**
 * Returnerer true hvis password matcher en af de almindelige
 * blocklist-entries (case-insensitive).
 */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
