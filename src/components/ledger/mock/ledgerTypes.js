/**
 * @typedef {Object} LedgerUserRow
 * @property {string} id
 * @property {string} fullName
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [avatarUrl]
 * @property {string} role
 * @property {'active'|'inactive'|'suspended'} status
 * @property {number} openingBalance
 * @property {number} currentBalance
 * @property {number} totalDebit
 * @property {number} totalCredit
 * @property {string} [lastTransactionAt] ISO
 * @property {'online'|'offline'|'recent'} activityIndicator
 * @property {string} [address]
 * @property {string} [accountStatus]
 * @property {string} [createdAt]
 * @property {string} [lastActivityAt]
 */

/**
 * @typedef {Object} LedgerTransaction
 * @property {string} id
 * @property {string} date
 * @property {string} referenceNo
 * @property {string} description
 * @property {string} [category]
 * @property {'debit'|'credit'} type
 * @property {number} debit
 * @property {number} credit
 * @property {string} [paymentMethod]
 * @property {string} createdBy
 * @property {'posted'|'pending'|'void'} [status]
 * @property {string} [notes]
 * @property {string} [debitAccount]
 * @property {string} [creditAccount]
 * @property {string[]} [linkedRefs]
 * @property {{name:string,url?:string}[]} [attachments]
 * @property {{at:string,action:string,by:string}[]} [auditTrail]
 */

export {};
