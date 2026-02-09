const START_DATE_KEYS = [
  'startdate',
  'start_date',
  'start',
  'from',
  'fromdate',
  'from_date',
  'depart',
  'departdate',
  'departure',
  'departuredate',
  'checkin',
  'check_in'
];

const END_DATE_KEYS = [
  'enddate',
  'end_date',
  'end',
  'to',
  'todate',
  'to_date',
  'return',
  'returndate',
  'return_date',
  'checkout',
  'check_out'
];

const AMOUNT_KEYS = [
  'price',
  'amount',
  'fare',
  'cost',
  'total',
  'totalprice',
  'total_price'
];

const toTitleCase = (value: string): string => {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const parseDateValue = (value: string): string => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  if (/^\d{8}$/.test(trimmedValue)) {
    return `${trimmedValue.slice(0, 4)}-${trimmedValue.slice(4, 6)}-${trimmedValue.slice(6, 8)}`;
  }

  const date = new Date(trimmedValue);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const parseAmountValue = (value: string): number | undefined => {
  const numericValue = Number(value.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }
  return numericValue;
};

const getParamValue = (url: URL, keys: string[]): string => {
  const params = Array.from(url.searchParams.entries()).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const key of keys) {
    const matchedParam = params.find(([paramKey]) => paramKey === key);
    if (matchedParam) {
      return matchedParam[1];
    }
  }
  return '';
};

export interface UrlAutofill {
  link: string;
  providerName: string;
  startDate: string;
  endDate: string;
  amount?: number;
}

export const getUrlAutofill = (rawUrl: string): UrlAutofill | null => {
  try {
    const url = new URL(rawUrl.trim());
    const hostname = url.hostname.replace(/^www\./, '');
    const providerSlug = hostname.split('.')[0] || hostname;

    const startDate = parseDateValue(getParamValue(url, START_DATE_KEYS));
    const endDate = parseDateValue(getParamValue(url, END_DATE_KEYS));
    const amount = parseAmountValue(getParamValue(url, AMOUNT_KEYS));

    return {
      link: url.toString(),
      providerName: toTitleCase(providerSlug),
      startDate,
      endDate,
      amount
    };
  } catch {
    return null;
  }
};
