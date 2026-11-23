/**
 * DawatDesk - Phone Formatter & Validation Utility
 * Supports Indian mobile numbers and international E.164 numbers.
 */

/**
 * Strips all non-digit characters except leading plus if present.
 * @param {string} phone
 * @returns {string}
 */
const cleanPhoneNumber = (phone) => {
  if (!phone) return '';
  return String(phone).trim().replace(/[\s\-\(\)\.]/g, '');
};

/**
 * Validates and normalizes phone numbers for WhatsApp delivery.
 *
 * Rules:
 * 1. Indian numbers:
 *    - 10 digits starting with 6, 7, 8, or 9 -> prefix with '91'
 *    - Leading '0' + 10 digits starting with 6-9 -> replace '0' with '91'
 *    - Leading '+91' or '91' + 10 digits starting with 6-9 -> '91XXXXXXXXXX'
 * 2. International numbers:
 *    - E.164 without leading '+' (digits only): 7 to 15 digits
 *    - Rejects repetitive/dummy numbers like '0000000000' or '1234567890'
 *
 * @param {string} phoneInput
 * @param {string} [defaultCountryCode='91']
 * @returns {{
 *   isValid: boolean,
 *   normalizedNumber: string,
 *   formattedDisplay: string,
 *   countryCode: string,
 *   nationalNumber: string,
 *   error?: string
 * }}
 */
const formatAndValidatePhone = (phoneInput, defaultCountryCode = '91') => {
  if (!phoneInput) {
    return {
      isValid: false,
      normalizedNumber: '',
      formattedDisplay: '',
      countryCode: '',
      nationalNumber: '',
      error: 'Phone number is required',
    };
  }

  const rawClean = cleanPhoneNumber(phoneInput);
  let digits = rawClean.replace(/\+/g, '');

  // Reject non-numeric characters
  if (!/^\d+$/.test(digits)) {
    return {
      isValid: false,
      normalizedNumber: '',
      formattedDisplay: rawClean,
      countryCode: '',
      nationalNumber: '',
      error: 'Phone number contains invalid characters',
    };
  }

  // Reject obvious dummy/repetitive numbers
  if (/^(\d)\1{7,}$/.test(digits) || digits === '1234567890' || digits === '9876543210') {
    return {
      isValid: false,
      normalizedNumber: '',
      formattedDisplay: rawClean,
      countryCode: '',
      nationalNumber: '',
      error: 'Phone number appears to be a test/dummy number',
    };
  }

  let countryCode = defaultCountryCode;
  let nationalNumber = digits;
  let normalized = '';

  // Case 1: Indian numbers with 0 prefix (e.g. 09825012345)
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    nationalNumber = digits.slice(1);
    countryCode = '91';
    normalized = `91${nationalNumber}`;
  }
  // Case 2: Indian 10-digit mobile number (e.g. 9825012345)
  else if (digits.length === 10 && /^[6-9]/.test(digits)) {
    nationalNumber = digits;
    countryCode = '91';
    normalized = `91${nationalNumber}`;
  }
  // Case 3: Indian number with country code (e.g. 919825012345)
  else if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    countryCode = '91';
    nationalNumber = digits.slice(2);
    normalized = digits;
  }
  // Case 4: International number starting with '+' in input
  else if (rawClean.startsWith('+')) {
    if (digits.length < 7 || digits.length > 15) {
      return {
        isValid: false,
        normalizedNumber: '',
        formattedDisplay: rawClean,
        countryCode: '',
        nationalNumber: digits,
        error: `International phone number length (${digits.length}) is invalid (must be 7-15 digits)`,
      };
    }
    normalized = digits;
    countryCode = digits.slice(0, Math.min(3, digits.length - 7));
    nationalNumber = digits.slice(countryCode.length);
  }
  // Case 5: International or domestic standard (7-15 digits)
  else if (digits.length >= 7 && digits.length <= 15) {
    // If 10 digits but doesn't start with 6-9, check if non-Indian
    if (digits.length === 10 && !/^[6-9]/.test(digits)) {
      return {
        isValid: false,
        normalizedNumber: '',
        formattedDisplay: rawClean,
        countryCode: '91',
        nationalNumber: digits,
        error: 'Indian 10-digit mobile numbers must start with 6, 7, 8, or 9',
      };
    }

    normalized = digits;
    countryCode = digits.slice(0, 2);
    nationalNumber = digits.slice(2);
  } else {
    return {
      isValid: false,
      normalizedNumber: '',
      formattedDisplay: rawClean,
      countryCode: '',
      nationalNumber: digits,
      error: `Invalid phone number length (${digits.length} digits). Expected 10 digits for India or 7-15 for international.`,
    };
  }

  // Beautiful formatted display
  let formattedDisplay = `+${normalized}`;
  if (countryCode === '91' && nationalNumber.length === 10) {
    formattedDisplay = `+91 ${nationalNumber.slice(0, 5)} ${nationalNumber.slice(5)}`;
  }

  return {
    isValid: true,
    normalizedNumber: normalized,
    formattedDisplay,
    countryCode,
    nationalNumber,
  };
};

module.exports = {
  cleanPhoneNumber,
  formatAndValidatePhone,
};
