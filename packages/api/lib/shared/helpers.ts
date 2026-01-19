/**
* Validates the API version format (yyyy-mm), restricting mm to 01, 04, 07, or 10.
*
* @param {string} version - The API version string to validate.
* @returns {boolean} - Returns true if the version matches yyyy-mm format with allowed months.
*/
export const isValidApiVersion = (version: string): boolean => {
 return version === 'dev' || /^\d{4}-(01|04|07|10)$/.test(version);
}