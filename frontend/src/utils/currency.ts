/**
 * TransitOps Currency Utility
 * Formats all financial figures in Indian Rupees (₹) across the platform.
 */
export const formatRupees = (amount: number | undefined | null, hideDecimals: boolean = true): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }
  
  if (hideDecimals) {
    return '₹' + Math.round(amount).toLocaleString('en-IN');
  }
  
  return '₹' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatCurrency = formatRupees;
export const CURRENCY_SYMBOL = '₹';
export const CURRENCY_CODE = 'INR';
