declare module 'ldml-number' {
  export = ldmlnum;

  function ldmlnum(pattern?: string, locale?: string): (value: number) => string;

  namespace ldmlnum {
    function round(value: number, decimal_places?: number): number;

    type Locale = {
      thousands_separator: string,
      decimal_separator: string,
      positive_sign: string,
      negative_sign: string,
      exponent_symbol: string,
      infinity_symbol: string,
      nan_symbol: string
    }

    const locale: {
      (group?: string, decimal?: string, plus?: string, minus?: string, exp?: string, inf?: string, nan?: string): Locale;

      [code: string]: Locale;

      ar_DZ: Locale;
      ar_LB: Locale;
      ar_LY: Locale;
      ar_MA: Locale;
      ar_MR: Locale;
      ar_TN: Locale;
      az: Locale;
      bs: Locale;
      ca: Locale;
      da: Locale;
      de: Locale;
      en_150: Locale;
      en_AT: Locale;
      en_BE: Locale;
      en_CH: Locale;
      en_DE: Locale;
      en_DK: Locale;
      en_NL: Locale;
      es: Locale;
      eu: Locale;
      fo: Locale;
      fr_LU: Locale;
      fr_MA: Locale;
      gl: Locale;
      hr: Locale;
      id: Locale;
      is: Locale;
      it: Locale;
      km: Locale;
      lo: Locale;
      mk: Locale;
      ms_BN: Locale;
      nl: Locale;
      pt: Locale;
      ro: Locale;
      sr: Locale;
      sw_CD: Locale;
      tr: Locale;
      vi: Locale;

      el: Locale;
      en_SI: Locale;
      sl: Locale;

      af: Locale;
      be: Locale;
      bg: Locale;
      cs: Locale;
      de_AT: Locale;
      en_FI: Locale;
      en_ZA: Locale;
      es_CR: Locale;
      fi: Locale;
      fr: Locale;
      fr_CA: Locale;
      hu: Locale;
      hy: Locale;
      ka: Locale;
      kk: Locale;
      ky: Locale;
      lv: Locale;
      no: Locale;
      pl: Locale;
      pt_AO: Locale;
      pt_CH: Locale;
      pt_CV: Locale;
      pt_GQ: Locale;
      pt_GW: Locale;
      pt_LU: Locale;
      pt_MO: Locale;
      pt_MZ: Locale;
      pt_PT: Locale;
      pt_ST: Locale;
      pt_TL: Locale;
      ru: Locale;
      sq: Locale;
      uz: Locale;

      sk: Locale;

      en_SE: Locale;
      et: Locale;
      lt: Locale;
      sv: Locale;

      uk: Locale;

      am: Locale;
      ar: Locale;
      bn: Locale;
      cy: Locale;
      en: Locale;
      en_CA: Locale;
      en_GB: Locale;
      en_US: Locale;
      es_419: Locale;
      es_BR: Locale;
      es_BZ: Locale;
      es_CU: Locale;
      es_DO: Locale;
      es_GT: Locale;
      es_HN: Locale;
      es_MX: Locale;
      es_NI: Locale;
      es_PA: Locale;
      es_PE: Locale;
      es_PR: Locale;
      es_SV: Locale;
      es_US: Locale;
      fa: Locale;
      fil: Locale;
      ga: Locale;
      gu: Locale;
      he: Locale;
      hi: Locale;
      ja: Locale;
      kn: Locale;
      ko: Locale;
      ml: Locale;
      mn: Locale;
      mr: Locale;
      ms: Locale;
      my: Locale;
      ne: Locale;
      pa: Locale;
      si: Locale;
      sw: Locale;
      ta: Locale;
      te: Locale;
      th: Locale;
      to: Locale;
      ur: Locale;
      yue: Locale;
      zh: Locale;
      zu: Locale;

      en_AU: Locale;

      de_CH: Locale;
      de_LI: Locale;
      it_CH: Locale;
    }
  }
}
