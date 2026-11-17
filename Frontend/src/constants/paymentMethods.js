export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank / M-Pesa' },
]

export const paymentMethodLabel = (value) =>
  PAYMENT_METHODS.find((entry) => entry.value === value)?.label || ''
