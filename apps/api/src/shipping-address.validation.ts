export const PERSON_NAME_PATTERN = /^(?=.*\p{L})[\p{L}\s.'-]+$/u;
export const PHONE_PATTERN = /^\d{10}$/;
export const ADDRESS_TEXT_PATTERN = /^(?=.*[\p{L}\d])[\p{L}\d\s.,'#/&()-]+$/u;
export const ADDRESS_NUMBER_PATTERN = /^(?=.*[\p{L}\d])[\p{L}\d\s#./-]+$/u;
export const PLACE_PATTERN = /^(?=.*\p{L})[\p{L}\d\s.'-]+$/u;
export const POSTAL_CODE_PATTERN = /^\d{5}$/;
export const COUNTRY_PATTERN = /^MX$/;
