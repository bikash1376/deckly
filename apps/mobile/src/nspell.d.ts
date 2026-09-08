/**
 * nspell ships no types. Only the two methods the spell checker uses are
 * declared here, rather than a speculative full surface.
 */
declare module "nspell" {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): NSpell;
  }
  export default function nspell(aff: string, dic: string): NSpell;
}
