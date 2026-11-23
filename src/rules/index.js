/**
 * Rule Finding representation.
 * @typedef {Object} Finding
 * @property {string} id 'CC001' | 'CC002' | 'CC003' | 'CC004' | 'CC005' | 'CC006'
 * @property {'error' | 'warning' | 'info'} severity
 * @property {string} file Relative path to file with issue
 * @property {number} line 1-based line number
 * @property {number} column 1-based column number
 * @property {string} title Short human readable title
 * @property {string} evidence Technical evidence details
 * @property {string} whyItMatters Explanation of impact
 * @property {string} fixAdvice Suggested remedy
 */

export { checkCC001 } from './cc001.js';
export { checkCC002 } from './cc002.js';
export { checkCC003 } from './cc003.js';
export { checkCC004 } from './cc004.js';
export { checkCC005 } from './cc005.js';
export { checkCC006 } from './cc006.js';
