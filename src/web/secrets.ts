/* Heuristic: does a variable key name look like it holds a secret? */

const SECRET_HINT =
  /(SECRET|TOKEN|PASSW(OR)?D|PRIVATE|API_?KEY|ACCESS_?KEY|CREDENTIAL|AUTH|SIGNING|DSN|_KEY$|_KEY_B64$|^KEY$)/i;
const NOT_SECRET = /(PUBLIC|_ID$)/i;

export function looksSecret(key: string): boolean {
  return SECRET_HINT.test(key) && !NOT_SECRET.test(key);
}
